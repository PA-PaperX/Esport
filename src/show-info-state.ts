import type { ShowInfo, ShowInfoSocial } from "./state";

// Show Info State Manager

const DB_FILE = "data/show-info.json";

const DEFAULT_SHOW_INFO: ShowInfo = {
  title: "Starting Soon",
  infoText: "The stream will begin shortly",
  leftLogo: "",
  leftText: "",
  centerText: "Powered by PaperX",
  rightLogo: "",
  socials: [],
};

class ShowInfoManager {
  private state: ShowInfo;

  constructor() {
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): ShowInfo {
    try {
      const file = Bun.file(DB_FILE);
      if (file.size > 0) {
        const data = JSON.parse(require("fs").readFileSync(DB_FILE, "utf-8"));
        return { ...DEFAULT_SHOW_INFO, ...data };
      }
    } catch (e) {
      console.log("📝 ShowInfo: Using defaults");
    }
    return { ...DEFAULT_SHOW_INFO };
  }

  public getState(): ShowInfo {
    return this.state;
  }

  public update(data: Partial<ShowInfo>): ShowInfo {
    this.state = { ...this.state, ...data };
    this.saveToDisk();
    return this.state;
  }

  public setSocials(socials: ShowInfoSocial[]): ShowInfo {
    this.state.socials = socials.slice(0, 3); // Max 3 socials
    this.saveToDisk();
    return this.state;
  }

  private async saveToDisk(): Promise<void> {
    try {
      await Bun.write(DB_FILE, JSON.stringify(this.state, null, 2));
      console.log(`💾 ShowInfo saved`);
    } catch (e) {
      console.error("❌ Failed to save ShowInfo:", e);
    }
  }
}

export const showInfoManager = new ShowInfoManager();
