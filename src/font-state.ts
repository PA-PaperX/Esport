// ==========================================
// Font State Manager
// ==========================================

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";

const FONT_SETTINGS_FILE = "./font-settings.json";
const FONTS_DIR = "./public/fonts/custom";

interface CustomFont {
  id: string;
  name: string; // User-defined display name
  filename: string; // Original filename
  format: string; // ttf, otf, woff, woff2
  path: string; // Web path like /fonts/custom/xxx.ttf
  weight?: string; // Font weight (normal, bold, 100-900)
  style?: string; // normal, italic
  createdAt: string;
}

interface FontAssignments {
  lowerThirdTitle: string | null;
  lowerThirdSlots: string | null;
  scoreboardTeamName: string | null;
  scoreboardScore: string | null;
  versusTeamName: string | null;
  bracketTeamName: string | null;
  transitionTitle: string | null;
}

interface FontSettings {
  fonts: CustomFont[];
  assignments: FontAssignments;
}

// Default state
const defaultState: FontSettings = {
  fonts: [],
  assignments: {
    lowerThirdTitle: null,
    lowerThirdSlots: null,
    scoreboardTeamName: null,
    scoreboardScore: null,
    versusTeamName: null,
    bracketTeamName: null,
    transitionTitle: null,
  },
};

class FontManager {
  private state: FontSettings;

  constructor() {
    this.state = this.loadState();
    // Scan fonts directory on startup
    this.scanFontsDirectory();
  }

  private loadState(): FontSettings {
    try {
      if (existsSync(FONT_SETTINGS_FILE)) {
        const data = readFileSync(FONT_SETTINGS_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Failed to load font settings:", err);
    }
    return { ...defaultState };
  }

  private saveState(): void {
    try {
      writeFileSync(FONT_SETTINGS_FILE, JSON.stringify(this.state, null, 2));
    } catch (err) {
      console.error("Failed to save font settings:", err);
    }
  }

  // Scan the fonts directory and auto-register any fonts found
  scanFontsDirectory(): void {
    try {
      if (!existsSync(FONTS_DIR)) {
        return;
      }

      const files = readdirSync(FONTS_DIR);
      const fontExtensions = [".ttf", ".otf", ".woff", ".woff2"];

      for (const file of files) {
        const ext = file.substring(file.lastIndexOf(".")).toLowerCase();
        if (!fontExtensions.includes(ext)) continue;

        // Check if font already registered
        const existing = this.state.fonts.find((f) => f.filename === file);
        if (existing) continue;

        // Auto-register font
        const format = this.getFormatFromExtension(ext);
        const baseName = file.substring(0, file.lastIndexOf("."));

        // Try to detect weight from filename
        const weight = this.detectWeight(baseName);
        const style = this.detectStyle(baseName);

        const font: CustomFont = {
          id: `font_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: this.formatName(baseName),
          filename: file,
          format: format,
          path: `/fonts/custom/${file}`,
          weight: weight,
          style: style,
          createdAt: new Date().toISOString(),
        };

        this.state.fonts.push(font);
        console.log(`📝 Auto-registered font: ${font.name}`);
      }

      // Remove fonts that no longer exist
      this.state.fonts = this.state.fonts.filter((font) => {
        const exists = files.includes(font.filename);
        if (!exists) {
          console.log(`🗑️ Removed missing font: ${font.name}`);
        }
        return exists;
      });

      this.saveState();
    } catch (err) {
      console.error("Failed to scan fonts directory:", err);
    }
  }

  private getFormatFromExtension(ext: string): string {
    const formats: Record<string, string> = {
      ".ttf": "truetype",
      ".otf": "opentype",
      ".woff": "woff",
      ".woff2": "woff2",
    };
    return formats[ext] || "truetype";
  }

  private detectWeight(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes("thin") || lower.includes("hairline")) return "100";
    if (lower.includes("extralight") || lower.includes("ultralight"))
      return "200";
    if (lower.includes("light")) return "300";
    if (lower.includes("medium")) return "500";
    if (lower.includes("semibold") || lower.includes("demibold")) return "600";
    if (lower.includes("extrabold") || lower.includes("ultrabold"))
      return "800";
    if (lower.includes("black") || lower.includes("heavy")) return "900";
    if (lower.includes("bold")) return "700";
    return "400"; // normal
  }

  private detectStyle(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes("italic") || lower.includes("oblique")) return "italic";
    return "normal";
  }

  private formatName(filename: string): string {
    // Convert filename to readable name
    // e.g., "Rajdhani-Bold" -> "Rajdhani Bold"
    return filename
      .replace(/[-_]/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim();
  }

  getState(): FontSettings {
    return this.state;
  }

  getFonts(): CustomFont[] {
    return this.state.fonts;
  }

  getFont(id: string): CustomFont | undefined {
    return this.state.fonts.find((f) => f.id === id);
  }

  addFont(font: Omit<CustomFont, "id" | "createdAt">): CustomFont {
    const newFont: CustomFont = {
      ...font,
      id: `font_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    this.state.fonts.push(newFont);
    this.saveState();
    return newFont;
  }

  updateFont(id: string, updates: Partial<CustomFont>): CustomFont | null {
    const index = this.state.fonts.findIndex((f) => f.id === id);
    if (index === -1) return null;

    this.state.fonts[index] = {
      ...this.state.fonts[index],
      ...updates,
    };
    this.saveState();
    return this.state.fonts[index];
  }

  deleteFont(id: string): boolean {
    const index = this.state.fonts.findIndex((f) => f.id === id);
    if (index === -1) return false;

    // Clear any assignments using this font
    const font = this.state.fonts[index];
    for (const key of Object.keys(
      this.state.assignments,
    ) as (keyof FontAssignments)[]) {
      if (this.state.assignments[key] === id) {
        this.state.assignments[key] = null;
      }
    }

    this.state.fonts.splice(index, 1);
    this.saveState();
    return true;
  }

  getAssignments(): FontAssignments {
    return this.state.assignments;
  }

  updateAssignments(assignments: Partial<FontAssignments>): FontAssignments {
    this.state.assignments = {
      ...this.state.assignments,
      ...assignments,
    };
    this.saveState();
    return this.state.assignments;
  }

  // Generate CSS for custom fonts
  generateCSS(): string {
    let css = "";

    for (const font of this.state.fonts) {
      css += `
@font-face {
  font-family: '${font.name}';
  src: url('${font.path}') format('${font.format}');
  font-weight: ${font.weight || "normal"};
  font-style: ${font.style || "normal"};
  font-display: swap;
}
`;
    }

    return css;
  }

  // Get font info for a specific assignment
  getAssignedFont(key: keyof FontAssignments): CustomFont | null {
    const fontId = this.state.assignments[key];
    if (!fontId) return null;
    return this.state.fonts.find((f) => f.id === fontId) || null;
  }
}

export const fontManager = new FontManager();
