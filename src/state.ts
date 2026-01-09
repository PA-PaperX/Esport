import { join } from "path";

// ==========================================
// 1. Data Schemas (โครงสร้างข้อมูล)
// ==========================================

export interface Player {
  slot: number;      // 1-5
  name: string;      // ชื่อในเกม e.g. "PaperX"
  realName?: string; // ชื่อจริง (เผื่อใช้)
  hero?: string;     // Hero ที่เล่น
  lane?: string;     // ตำแหน่ง (ออฟเลน, ป่า, เมจ, แครี่, โรมมิ่ง)
  isCaptain?: boolean; // กัปตันทีม
}

export interface Team {
  name: string;      // ชื่อทีม e.g. "Buriram United"
  shortName: string; // ตัวย่อ e.g. "BRU"
  color: string;     // สีทีม (Hex) e.g. "#00008b"
  logo: string;      // Path โลโก้ (ว่างได้)
  logoVersion?: number; // Version สำหรับ Cache Busting
  score: number;     // คะแนนปัจจุบัน
  players: Player[]; // รายชื่อผู้เล่น 5 คน
}

export interface MatchState {
  matchId: string;
  linkedMatchId: string | null;  // Bracket match ID for score sync
  bestOf: number;    // แข่งกี่เกม (Bo1, Bo3, Bo5)
  currentGame: number;
  swapped: boolean;  // สลับฝั่ง: false = Team A ซ้าย, true = Team A ขวา
  teams: {
    A: Team;
    B: Team;
  };
}

// Lower Third / Bottom Bar State
export interface LowerThirdSlot {
  id: number;          // 1, 2, 3
  enabled: boolean;    // เปิด/ปิดช่อง
  type: 'logo' | 'text'; // โหมด logo หรือ text
  logoPath: string;    // path ของโลโก้
  text: string;        // ข้อความ
  label: string;       // ชื่อช่อง (เช่น "Facebook", "YouTube")
}

export interface LowerThirdState {
  enabled: boolean;              // เปิด/ปิดทั้ง Bar
  title: string;                 // ข้อความหลัก (เช่น "ROV PRO LEAGUE 2025 WINTER")
  backgroundColor: string;       // สีพื้นหลัง
  textColor: string;             // สีข้อความ
  slots: LowerThirdSlot[];       // 3 ช่อง
}

// ==========================================
// 2. Default State (ค่าเริ่มต้น)
// ==========================================

const DEFAULT_PLAYERS = (prefix: string) =>
  Array.from({ length: 5 }, (_, i) => ({
    slot: i + 1,
    name: `${prefix} Player ${i + 1}`,
    hero: ""
  }));

export const INITIAL_STATE: MatchState = {
  matchId: "match_init",
  linkedMatchId: null,
  bestOf: 3,
  currentGame: 1,
  swapped: false,
  teams: {
    A: {
      name: "HOME TEAM",
      shortName: "HOME",
      color: "#3b82f6", // Blue-500
      logo: "",
      logoVersion: Date.now(),
      score: 0,
      players: DEFAULT_PLAYERS("Home")
    },
    B: {
      name: "AWAY TEAM",
      shortName: "AWAY",
      color: "#ef4444", // Red-500
      logo: "",
      logoVersion: Date.now(),
      score: 0,
      players: DEFAULT_PLAYERS("Away")
    }
  }
};

// ==========================================
// 3. State Manager (Logic จัดการข้อมูล)
// ==========================================

const DB_FILE = "match-data.json"; // ไฟล์ที่จะบันทึก state ไว้กันหาย

export class StateManager {
  private state: MatchState;

  constructor() {
    this.state = this.loadFromDisk();
  }

  // โหลดข้อมูลเก่า ถ้าไม่มีให้ใช้ค่าเริ่มต้น
  private loadFromDisk(): MatchState {
    try {
      // *หมายเหตุ: ใน Bun การอ่านไฟล์แบบ sync ทำได้ง่ายเพื่อ init state
      // แต่เพื่อความชัวร์ใน v1 เราจะใช้ memory เป็นหลักก่อน แล้วค่อย load file
      // เดี๋ยวเรามาเติม logic อ่านไฟล์จริงจังใน step ต่อไป
      return INITIAL_STATE;
    } catch (e) {
      console.error("⚠️ Load state failed, using default");
      return INITIAL_STATE;
    }
  }

  // ดึงข้อมูลปัจจุบัน
  public getState(): MatchState {
    return this.state;
  }

  // อัปเดตข้อมูลทีม (Partial update)
  public updateTeam(side: 'A' | 'B', data: Partial<Team>) {
    this.state.teams[side] = { ...this.state.teams[side], ...data };
    this.saveToDisk();
  }

  // อัปเดตข้อมูลผู้เล่นรายคน
  public updatePlayer(side: 'A' | 'B', slot: number, data: Partial<Player>) {
    const team = this.state.teams[side];
    const index = team.players.findIndex(p => p.slot === slot);

    if (index !== -1) {
      team.players[index] = { ...team.players[index], ...data };
      this.saveToDisk();
    }
  }

  // สลับฝั่งทีม
  public toggleSwap(): boolean {
    this.state.swapped = !this.state.swapped;
    this.saveToDisk();
    return this.state.swapped;
  }

  // Link/Unlink bracket match for score sync
  public setLinkedMatch(matchId: string | null): void {
    this.state.linkedMatchId = matchId;
    this.saveToDisk();
    console.log(`🔗 Linked match: ${matchId || 'none'}`);
  }

  public getLinkedMatch(): string | null {
    return this.state.linkedMatchId;
  }

  // ฟังก์ชันบันทึกข้อมูล (จำลอง)
  private async saveToDisk() {
    await Bun.write(DB_FILE, JSON.stringify(this.state, null, 2));
    console.log(`💾 State saved to ${DB_FILE}`);
    // TODO: ตรงนี้เดี๋ยวเราจะใส่ WebSocket Broadcast ไปหา Overlay
  }
}

// Export ตัวแปรเดียวให้ทั้งแอปใช้ (Singleton)
export const stateManager = new StateManager();