# Atom Discord Relay WS

Raw Discord Gateway relay ของ Atom Oracle — เขียนเองเพื่อพิสูจน์ว่า Discord Gateway อ่านห้องได้โดยไม่ใช้ `discord.js`.

## จุดสำคัญ

- ใช้ Bun `WebSocket` ตรงไปที่ `wss://gateway.discord.gg/?v=10&encoding=json`
- ส่ง heartbeat และ Identify เอง
- ฟัง `MESSAGE_CREATE`
- ค่า default เป็น read/proof mode ไม่ relay ออกไปไหน
- ถ้าต้องการ relay จริงให้ใช้ `--relay-agent <agent>` เพื่อเรียก `maw-rs hey`
- ไม่ print token และล้าง env ลับก่อนส่ง subprocess

## ใช้งาน

```bash
DISCORD_BOT_TOKEN <from secret env> bun run atom-discord-relay-ws.ts --channel 1512079809021214730 --duration-ms 30000
```

หรือใช้ token file:

```bash
bun run atom-discord-relay-ws.ts --token-file /path/to/token --channel 1512079809021214730 --duration-ms 30000
```

Relay mode:

```bash
bun run atom-discord-relay-ws.ts --channel 1512079809021214730 --relay-agent atom
```

## Proof checklist

- `websocket open`
- `heartbeat interval`
- `identify sent`
- `ready as <bot>`
- `MESSAGE_CREATE ...` จาก channel ที่ filter
