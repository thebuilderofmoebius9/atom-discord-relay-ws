#!/usr/bin/env bun
/**
 * Atom Discord Relay WS — raw Discord Gateway reader/relay.
 *
 * - No discord.js; uses Bun's WebSocket.
 * - Safe by default: reads/logs matching messages only.
 * - Optional relay: pass --relay-agent <name> to call `maw hey <name> <text>`.
 * - Secrets are never printed; token comes from env or a token file.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json";
const INTENTS = 1 | 512 | 4096 | 32768; // GUILDS | GUILD_MESSAGES | DIRECT_MESSAGES | MESSAGE_CONTENT = 37377
const DEFAULT_DURATION_MS = 30_000;

type GatewayPacket = { op: number; d?: any; s?: number | null; t?: string | null };
type Message = {
  id: string;
  channel_id: string;
  guild_id?: string;
  content?: string;
  author?: { id: string; username?: string; bot?: boolean };
  attachments?: Array<{ url: string; filename?: string }>;
};

type Args = {
  channel?: string;
  guild?: string;
  durationMs: number;
  tokenEnv: string;
  tokenFile?: string;
  relayAgent?: string;
  includeBots: boolean;
  once: boolean;
};

function argValue(flag: string): string | undefined {
  const i = Bun.argv.indexOf(flag);
  return i >= 0 ? Bun.argv[i + 1] : undefined;
}

function parseArgs(): Args {
  const durationRaw = argValue("--duration-ms") ?? argValue("--duration");
  return {
    channel: argValue("--channel"),
    guild: argValue("--guild"),
    durationMs: durationRaw ? Number(durationRaw) : DEFAULT_DURATION_MS,
    tokenEnv: argValue("--token-env") ?? "DISCORD_BOT_TOKEN",
    tokenFile: argValue("--token-file"),
    relayAgent: argValue("--relay-agent"),
    includeBots: Bun.argv.includes("--include-bots"),
    once: Bun.argv.includes("--once"),
  };
}

function unquoteToml(value: string): string {
  const trimmed = value.trim().replace(/,#.*$/, "").replace(/,$/, "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function tokenFromCcConnectToml(raw: string): string | undefined {
  let inDiscordPlatform = false;
  let inOptions = false;
  for (const line of raw.split(/\r?\n/)) {
    const stripped = line.replace(/#.*$/, "").trim();
    if (!stripped) continue;
    if (stripped === "[[projects.platforms]]") {
      inDiscordPlatform = false;
      inOptions = false;
      continue;
    }
    if (stripped.startsWith("[") && stripped !== "[projects.platforms.options]") {
      inOptions = false;
    }
    if (stripped === "[projects.platforms.options]" && inDiscordPlatform) {
      inOptions = true;
      continue;
    }
    const eq = stripped.indexOf("=");
    if (eq < 0) continue;
    const key = stripped.slice(0, eq).trim();
    const value = unquoteToml(stripped.slice(eq + 1));
    if (key === "type" && value === "discord") inDiscordPlatform = true;
    if (inDiscordPlatform && inOptions && key === "token" && value.trim()) return value.trim();
  }
  return undefined;
}

function readToken(args: Args): string {
  const envToken = process.env[args.tokenEnv];
  if (envToken?.trim()) return envToken.trim();
  if (args.tokenFile) {
    if (!existsSync(args.tokenFile)) throw new Error("token file not found");
    const raw = readFileSync(args.tokenFile, "utf8");
    const direct = raw.trim();
    if (/^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{20,}$/.test(direct)) return direct;
    const fromCcConnect = tokenFromCcConnectToml(raw);
    if (fromCcConnect) return fromCcConnect;
  }
  throw new Error(`missing token: set ${args.tokenEnv} or pass --token-file`);
}

function shouldAccept(msg: Message, args: Args): boolean {
  if (!args.includeBots && msg.author?.bot) return false;
  if (args.channel && msg.channel_id !== args.channel) return false;
  if (args.guild && msg.guild_id !== args.guild) return false;
  return true;
}

function formatMessage(msg: Message): string {
  const user = msg.author?.username ?? msg.author?.id ?? "unknown";
  const text = (msg.content ?? "").trim();
  const files = (msg.attachments ?? [])
    .map((a) => `${a.filename ?? "attachment"}: ${a.url}`)
    .join("\n");
  return [`[Discord #${msg.channel_id} จาก ${user}]`, text, files].filter(Boolean).join("\n");
}

function relayToAgent(agent: string, formattedText: string): boolean {
  const maw = process.platform === "darwin" ? "maw" : "/usr/local/bin/maw-rs";
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/TOKEN|SECRET|PASSWORD|API_KEY|DISCORD/i.test(key)) delete env[key];
  }
  const res = spawnSync(maw, ["hey", agent, formattedText], {
    env,
    encoding: "utf8",
    timeout: 25_000,
    maxBuffer: 64 * 1024,
  });
  if (res.status === 0) return true;
  console.error(`[atom-gw] relay failed status=${res.status} signal=${res.signal ?? ""}`);
  return false;
}

async function main() {
  const args = parseArgs();
  const token = readToken(args);
  let seq: number | null = null;
  let heartbeat: Timer | undefined;
  let seen = 0;
  let resolved = false;

  console.log("[atom-gw] Atom raw Discord Gateway relay v0.1.0");
  console.log(`[atom-gw] intents: ${INTENTS} (GUILDS|GUILD_MESSAGES|DM|MESSAGE_CONTENT)`);
  if (args.channel) console.log(`[atom-gw] filter channel: ${args.channel}`);
  if (args.guild) console.log(`[atom-gw] filter guild: ${args.guild}`);
  console.log(args.relayAgent ? `[atom-gw] relay target: ${args.relayAgent}` : "[atom-gw] relay: disabled (read/proof mode)");

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(GATEWAY);
    const stop = (why: string) => {
      if (resolved) return;
      resolved = true;
      if (heartbeat) clearInterval(heartbeat);
      try { ws.close(); } catch {}
      console.log(`[atom-gw] stop: ${why}; matched_messages=${seen}`);
      resolve();
    };
    const timeout = setTimeout(() => stop("duration reached"), args.durationMs);

    ws.addEventListener("open", () => console.log("[atom-gw] websocket open"));
    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("websocket error"));
    });
    ws.addEventListener("close", (event) => {
      if (!resolved) stop(`websocket closed code=${event.code} reason=${event.reason || "none"}`);
    });
    ws.addEventListener("message", (event) => {
      const packet = JSON.parse(String(event.data)) as GatewayPacket;
      if (typeof packet.s === "number") seq = packet.s;

      if (packet.op === 10) {
        const interval = Number(packet.d.heartbeat_interval);
        console.log(`[atom-gw] heartbeat interval: ${interval}ms`);
        heartbeat = setInterval(() => ws.send(JSON.stringify({ op: 1, d: seq })), interval);
        ws.send(JSON.stringify({
          op: 2,
          d: {
            token,
            intents: INTENTS,
            properties: { $os: process.platform, $browser: "atom-raw-ws", $device: "atom-raw-ws" },
          },
        }));
        console.log("[atom-gw] identify sent");
        return;
      }

      if (packet.op === 11) return;
      if (packet.op === 7) return stop("discord requested reconnect");
      if (packet.op === 9) return stop("invalid session");

      if (packet.op === 0 && packet.t === "READY") {
        console.log(`[atom-gw] ready as ${packet.d.user?.username ?? "unknown"}#${packet.d.user?.discriminator ?? ""} session=${String(packet.d.session_id ?? "").slice(0, 8)}...`);
        return;
      }

      if (packet.op === 0 && packet.t === "MESSAGE_CREATE") {
        const msg = packet.d as Message;
        if (!shouldAccept(msg, args)) return;
        seen += 1;
        const formatted = formatMessage(msg);
        const preview = formatted.replace(/\s+/g, " ").slice(0, 220);
        console.log(`[atom-gw] MESSAGE_CREATE #${seen} id=${msg.id} author=${msg.author?.username ?? msg.author?.id ?? "unknown"} preview=${preview}`);
        if (args.relayAgent) relayToAgent(args.relayAgent, formatted);
        if (args.once) stop("once matched");
      }
    });
  });
}

main().catch((error) => {
  console.error(`[atom-gw] error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
