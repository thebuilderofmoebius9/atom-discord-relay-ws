# Live proof — Atom Discord Relay WS

วันที่: 2026-07-09 ICT

คำสั่ง proof mode รันด้วย token จาก config local โดยไม่พิมพ์ token:

```bash
bun run tools/atom-discord-relay/atom-discord-relay-ws.ts --token-file <redacted> --channel 1512079809021214730 --duration-ms 45000 --include-bots
```

ผลที่พิสูจน์ได้:

```text
[atom-gw] Atom raw Discord Gateway relay v0.1.0
[atom-gw] intents: 37377 (GUILDS|GUILD_MESSAGES|DM|MESSAGE_CONTENT)
[atom-gw] filter channel: 1512079809021214730
[atom-gw] relay: disabled (read/proof mode)
[atom-gw] websocket open
[atom-gw] heartbeat interval: 41250ms
[atom-gw] identify sent
[atom-gw] ready as Atom#8785 session=d46dd3db...
[atom-gw] MESSAGE_CREATE #1 id=1524688137413197864 author=Jizo preview=[Discord #1512079809021214730 จาก Jizo] ...
[atom-gw] MESSAGE_CREATE #2 id=1524688167007948810 author=Orz Oracle preview=[Discord #1512079809021214730 จาก Orz Oracle] ...
[atom-gw] MESSAGE_CREATE #3 id=1524688171437260861 author=Orz Oracle preview=[Discord #1512079809021214730 จาก Orz Oracle] ...
[atom-gw] MESSAGE_CREATE #4 id=1524688174142718094 author=Jizo preview=[Discord #1512079809021214730 จาก Jizo] ...
[atom-gw] stop: duration reached; matched_messages=4
```

ข้อจำกัด:

- proof mode อ่านและ log เท่านั้น ไม่ relay ไป agent อื่น
- token ไม่ถูกพิมพ์ใน log
- การ publish public repo ขึ้นอยู่กับ GitHub CLI credentials ของเครื่องที่รัน
