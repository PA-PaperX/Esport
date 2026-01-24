# Esport Control Panel (RoV Tournament Overlay System)

> **Version:** 1.0.0  
> **Developed by:** [PaperX,ntdotjsx]  
> **Powered by:** Tauri v2, Bun, TypeScript

ระบบควบคุมกราฟิก Overlay สำหรับการถ่ายทอดสดการแข่งขัน Esport (MOBA / RoV) แบบ Real-time ออกแบบมาเพื่อลดภาระทีมงาน OB และเพิ่มความสวยงามให้กับการแข่ง

![Overlay Preview](public/overlay-rov.html)

## ฟีเจอร์หลัก

### 1. Tournament Bracket System (ระบบสายแข่ง)

- **จัดการสายการแข่ง**: รองรับ Double Elimination, Single Elimination
- **Real-time Sync**: เชื่อมต่อคะแนนจากหน้า Bracket ไปยัง Overlay ทันที
- **Auto Shuffle**: ระบบสุ่มสายแข่งอัตโนมัติ พร้อมAnimation เปิดตัว

### 2. Dynamic Font & Theme (ปรับแต่งอิสระ)

- **Custom Fonts**: อัพโหลดฟอนต์ .ttf/.otf ได้เองผ่านหน้าเว็บ
- **Advanced Styling**: ปรับสี, GLOW (แสงเรือง), ตัวหนา, ตัวเอียง ได้แยกตามจุด (ชื่อทีม, คะแนน, หัวข้อ)
- **Settings Persistence**: บันทึกค่าการตั้งค่าฟอนต์ไว้ใช้งานครั้งต่อไป

### 3. HUD & Overlays (หน้าจอถ่ายทอดสด)

- **Versus Screen**: หน้าจอแนะนำทีมก่อนเริ่มเกม พร้อมแสดง Hero Picks/Bans
- **Hero Bars (Team A/B)**: แถบแสดงฮีโร่ฝั่งซ้าย/ขวา พร้อมชื่อผู้เล่นและตำแหน่ง
- **In-Game Overlay**: สกอร์บอร์ด

### 4. Control Panel & OBS control

- ควบคุมทุกอย่างผ่านโปรแกรม หรือ Localhost:3000
- **Automated Scene Switching**: สั่งเปลี่ยน Scene ใน OBS อัตโนมัติเมื่อกด Reset หรือเริ่มเกม (ผ่าน OBS WebSocket)

## เทคโนโลยีที่ใช้ (Tech Stack)

- **Core**: [Tauri v2](https://tauri.app) (Rust sidecar for performance)
- **Runtime**: [Bun](https://bun.sh) (Fast JavaScript Runtime)
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (No Framework overhead)
- **Backend Logic**: TypeScript (Bun API)
- **Data Storage**: JSON (Local file system)

## การติดตั้งและการใช้งาน (Installation)

### สำหรับผู้ใช้ทั่วไป

1. ดาวน์โหลดไฟล์ `.exe` จากเมนู Releases
2. ติดตั้งและเปิดโปรแกรม `Esport Control Panel`
3. หรือบางคนอยากใช้บนเว็บ สามารถเปิด Browser ไปที่ `http://localhost:3000` (หรือใช้งานผ่านหน้าต่างโปรแกรม)
4. ตั้งค่า OBS WebSocket ในเมนู Settings เพื่อเชื่อมต่อ

### สำหรับนักพัฒนา (Developer)

โปรต้องการ `Bun` และ `Rust` ในการ Build

```bash
# 1. Clone repository
git clone https://github.com/PA-PaperX/Esport_Control_Panel.git

# 2. Install dependencies
bun install

# 3. Run Development Server
bun run dev
# หรือ
bun run tauri dev

# 4. Build for Production
bun run tauri build
```

## License & Terms

โปรเจกต์นี้เปิดเป็น **Open Source** ภายใต้สัญญาอนุญาต **GNU GPLv3**
[(ดูรายละเอียดในไฟล์ LICENSE)](LICENSE)

**ข้อกำหนด:**

- ✅ อนุญาตให้นำไปใช้จัดแข่ง, แก้ไขโค้ด, หรือศึกษาเรียนรู้
- ⚠️ **ต้องเปิดเผย Source Code** หากมีการแก้ไขและเผยแพร่ต่อ (Copyleft)
- ⚠️ **ต้องให้เครดิตผู้พัฒนาเดิม** (Credit the original author)
- ❌ ห้ามนำไปขายต่อในเชิงพาณิชย์โดยตรง (Not for direct resale)

---

_Open Source for the Community. Created with ❤️ for Esport._
