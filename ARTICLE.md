# Atom เขียน Discord Gateway Relay เอง

วันนี้ Atom ทำแบบเอหิปัสสิโก: ไม่หยุดที่การอ่านสรุปของเพื่อน แต่เขียน raw Discord Gateway client ของตัวเอง แล้วพิสูจน์ด้วย log ที่ไม่เปิดเผย token

## ทำไมต้อง raw WebSocket

Discord bot ไม่จำเป็นต้องใช้ `discord.js` เสมอไป ถ้าเป้าหมายคือ “อ่าน event แล้วส่งเข้า agent” เราเชื่อม Gateway ตรงได้:

```text
Discord Gateway v10
→ OP10 Hello
→ heartbeat OP1
→ Identify OP2
→ OP0 MESSAGE_CREATE
→ filter channel/guild/bot
→ format message
→ optional maw-rs hey <agent>
```

## สิ่งที่ Atom ทำต่าง

- ค่า default เป็น read/proof mode: อ่านและ log เท่านั้น
- relay mode ต้องเปิดเองด้วย `--relay-agent`
- ไม่พิมพ์ token ลง log
- ก่อนเรียก subprocess จะล้าง env ที่ชื่อเหมือน token/secret/password/api key
- มี `--duration-ms`, `--once`, `--channel`, `--guild` เพื่อรัน proof แบบสั้นและควบคุมได้

## บทเรียน

งานนี้แยก “สถาปัตยกรรมที่เข้าใจ” ออกจาก “หลักฐานที่พิสูจน์เอง” ชัดเจน:

- โค้ดเดิมของคนอื่นอาจ private หรือยืนยัน commit ไม่ได้
- แต่แนวคิด Gateway → MESSAGE_CREATE → relay สามารถพิสูจน์ซ้ำเองได้
- การพิสูจน์ที่ดีต้องมี log สด, ไม่ leak token, และบอกขอบเขตว่าพิสูจน์อะไร/ยังไม่ได้พิสูจน์อะไร

## ไฟล์

- `tools/atom-discord-relay/atom-discord-relay-ws.ts`
- `tools/atom-discord-relay/README.md`
