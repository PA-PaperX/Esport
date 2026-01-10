import { LowerThirdState, LowerThirdSlot } from "./state";

// ==========================================
// Lower Third State Manager
// ==========================================

const LOWER_THIRD_FILE = "lower-third-data.json";

// Default state สำหรับ Lower Third
export const INITIAL_LOWER_THIRD: LowerThirdState = {
  enabled: true,
  title: "ROV PRO LEAGUE 2025 WINTER",
  backgroundColor: "#1a1a2e",
  textColor: "#ffffff",
  slots: [
    {
      id: 1,
      enabled: true,
      type: "logo",
      logoPath: "",
      text: "Facebook",
      label: "Facebook",
    },
    {
      id: 2,
      enabled: true,
      type: "logo",
      logoPath: "",
      text: "YouTube",
      label: "YouTube",
    },
    {
      id: 3,
      enabled: true,
      type: "logo",
      logoPath: "",
      text: "TikTok",
      label: "TikTok",
    },
  ],
};

class LowerThirdManager {
  private state: LowerThirdState;

  constructor() {
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): LowerThirdState {
    try {
      const file = Bun.file(LOWER_THIRD_FILE);
      if (file.size > 0) {
        const data = JSON.parse(
          require("fs").readFileSync(LOWER_THIRD_FILE, "utf-8"),
        );
        return { ...INITIAL_LOWER_THIRD, ...data };
      }
    } catch (e) {
      console.log("📺 Using default Lower Third state");
    }
    return INITIAL_LOWER_THIRD;
  }

  public getState(): LowerThirdState {
    return this.state;
  }

  public updateState(data: Partial<LowerThirdState>) {
    this.state = { ...this.state, ...data };
    this.saveToDisk();
  }

  public updateSlot(slotId: number, data: Partial<LowerThirdSlot>) {
    const index = this.state.slots.findIndex((s) => s.id === slotId);
    if (index !== -1) {
      this.state.slots[index] = { ...this.state.slots[index], ...data };
      this.saveToDisk();
    }
  }

  public setSlotLogo(slotId: number, logoPath: string) {
    this.updateSlot(slotId, { logoPath, type: "logo" });
  }

  public toggleEnabled(enabled?: boolean) {
    this.state.enabled = enabled !== undefined ? enabled : !this.state.enabled;
    this.saveToDisk();
    return this.state.enabled;
  }

  private async saveToDisk() {
    await Bun.write(LOWER_THIRD_FILE, JSON.stringify(this.state, null, 2));
    console.log(`💾 Lower Third state saved`);
  }
}

export const lowerThirdManager = new LowerThirdManager();
