ภาพรวมของระบบ

ระบบประกอบด้วย 3 ส่วนหลัก ได้แก่

เซิร์ฟเวอร์ (Bun): ทำหน้าที่จัดการสถานะของสายการแข่งขันและกระจายข้อมูลอัปเดต

แผงควบคุม (Control Panel): ส่วนติดต่อเว็บสำหรับผู้ดูแลระบบในการจัดการทัวร์นาเมนต์

โอเวอร์เลย์ (Overlay): หน้าแสดงผลสำหรับการถ่ายทอดสด ใช้แสดงสายการแข่งขันเท่านั้น (ไม่สามารถแก้ไขข้อมูลได้)

WebSocket API (แบบเรียลไทม์)

สำหรับการสร้างแอนิเมชันแบบเรียลไทม์ ให้เชื่อมต่อกับ WebSocket Server

ที่อยู่ (URL): ws://localhost:3000 (หรือ ws://your-ip:3000)

รูปแบบข้อมูล: ข้อความแบบ JSON

การรับฟังการอัปเดต

เมื่อมีการเปลี่ยนแปลงของสายการแข่งขัน (เช่น การอัปเดตคะแนน หรือการเปลี่ยนรอบการแข่งขัน) เซิร์ฟเวอร์จะส่งข้อความกระจายข้อมูลดังนี้

{
"type": "BRACKET_UPDATE",
"data": {
"id": "bracket_123",
"name": "Tournament Name",
"matches": [ ...match objects... ]
}
}

คำแนะนำสำหรับการทำแอนิเมชัน

เชื่อมต่อกับ WebSocket

เมื่อได้รับ BRACKET_UPDATE ให้เปรียบเทียบข้อมูล data ใหม่กับสถานะปัจจุบัน

หากคะแนนมีการเปลี่ยนแปลง ให้ทำแอนิเมชันตัวเลขคะแนน

หากมีการตัดสินผู้ชนะ ให้ทำแอนิเมชันเส้นทางการผ่านเข้าสู่รอบถัดไป

HTTP API (REST)
ดึงข้อมูลสายการแข่งขันปัจจุบัน

GET /api/bracket
ส่งคืนออบเจกต์สถานะของสายการแข่งขันทั้งหมดในปัจจุบัน

สร้างสายการแข่งขัน

POST /api/bracket/create
ข้อมูลที่ส่งไป (Body):

{
"name": "Tournament Name",
"type": "single", // หรือ "double"
"teams": ["Team A", "Team B", ...],
"teamData": [ { "name": "Team A", "logo": "...", "color": "..." }, ... ]
}

อัปเดตคะแนนของการแข่งขัน

POST /api/bracket/match/update
ข้อมูลที่ส่งไป (Body):

{
"matchId": "match_r1_1",
"scoreA": 2,
"scoreB": 1,
"winner": "A" // ไม่บังคับ: "A", "B" หรือ null
}

โครงสร้างข้อมูล
ออบเจกต์ Bracket
{
"id": "uuid",
"name": "Tournament 2025",
"type": "single",
"matches": [ ... ]
}

ออบเจกต์ Match
{
"id": "match_r1_1",
"round": 1,
"position": 1,
"roundName": "Quarterfinal",
"teamA": { "name": "Team 1", "logo": "url", "color": "#hex" },
"teamB": { "name": "Team 2", "logo": "url", "color": "#hex" },
"scoreA": 0,
"scoreB": 0,
"winner": null, // จะเป็น "A" หรือ "B" เมื่อมีการตัดสินผล
"nextMatchId": "match_r2_1",
"nextSlot": "A"
}
