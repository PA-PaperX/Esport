// Wait Timer State Manager

const DB_FILE = "data/wait-timer.json";

interface WaitTimerState {
  seconds: number;
  running: boolean;
  endTime: number | null;
}

const DEFAULT_TIMER_STATE: WaitTimerState = {
  seconds: 0,
  running: false,
  endTime: null,
};

class WaitTimerManager {
  private state: WaitTimerState;

  constructor() {
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): WaitTimerState {
    try {
      const file = Bun.file(DB_FILE);
      if (file.size > 0) {
        const data = JSON.parse(require("fs").readFileSync(DB_FILE, "utf-8"));
        return { ...DEFAULT_TIMER_STATE, ...data };
      }
    } catch (e) {
      console.log("⏱️ WaitTimer: Using defaults");
    }
    return { ...DEFAULT_TIMER_STATE };
  }

  public getState(): WaitTimerState {
    // If timer is running, update seconds based on endTime
    if (this.state.running && this.state.endTime) {
      const remaining = Math.max(0, this.state.endTime - Date.now());
      this.state.seconds = Math.ceil(remaining / 1000);

      // Auto-stop if time is up
      if (remaining <= 0) {
        this.state.running = false;
        this.state.endTime = null;
        this.saveToDisk();
      }
    }
    return this.state;
  }

  public setTimer(seconds: number): WaitTimerState {
    this.state.seconds = seconds;
    this.state.running = false;
    this.state.endTime = null;
    this.saveToDisk();
    return this.state;
  }

  public startTimer(): WaitTimerState {
    if (this.state.seconds > 0) {
      this.state.running = true;
      this.state.endTime = Date.now() + this.state.seconds * 1000;
      this.saveToDisk();
    }
    return this.state;
  }

  public stopTimer(): WaitTimerState {
    if (this.state.running && this.state.endTime) {
      // Calculate remaining time and save it
      const remaining = Math.max(0, this.state.endTime - Date.now());
      this.state.seconds = Math.ceil(remaining / 1000);
    }
    this.state.running = false;
    this.state.endTime = null;
    this.saveToDisk();
    return this.state;
  }

  public resetTimer(): WaitTimerState {
    this.state.seconds = 0;
    this.state.running = false;
    this.state.endTime = null;
    this.saveToDisk();
    return this.state;
  }

  private async saveToDisk(): Promise<void> {
    try {
      await Bun.write(DB_FILE, JSON.stringify(this.state, null, 2));
      console.log(
        `💾 WaitTimer saved: ${this.state.seconds}s, running: ${this.state.running}`,
      );
    } catch (e) {
      console.error("❌ Failed to save WaitTimer:", e);
    }
  }
}

export const waitTimerManager = new WaitTimerManager();
