export {};

// ==========================================
// Interfaces (Strict Typing)
// ==========================================

interface Player {
  slot: number;
  name: string;
  realName?: string;
  hero?: string;
  lane?: string;
  isCaptain?: boolean;
}

interface Team {
  name: string;
  shortName: string;
  color: string;
  logo: string;
  logoFit?: "contain" | "cover";
  score: number;
  players: Player[];
}

interface MatchState {
  matchId: string;
  bestOf: number;
  currentGame: number;
  swapped?: boolean;
  teams: {
    A: Team;
    B: Team;
  };
}

interface WSMessage {
  type: string;
  data: MatchState;
}

// ==========================================
// State & WebSocket Variables
// ==========================================

let currentState: MatchState | null = null;
let ws: WebSocket | null = null;
let reconnectInterval: number | null = null;
const RECONNECT_DELAY = 3000;
const WS_URL = `ws://${window.location.host}`;
const API_BASE = `http://${window.location.host}`;

// ==========================================
// DOM Elements
// ==========================================

const getElement = <T extends HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

// Logo Cache Busting
let logoVersions: { A: number; B: number } = {
  A: Date.now(),
  B: Date.now(),
};

const elements = {
  statusDot: () => getElement<HTMLDivElement>("status-dot"),
  connectionStatus: () => getElement<HTMLDivElement>("connection-status"),
  teamAName: () => getElement<HTMLInputElement>("teamA-name"),
  teamAColor: () => getElement<HTMLInputElement>("teamA-color"),
  teamAColorHex: () => getElement<HTMLSpanElement>("teamA-color-hex"),
  teamAScore: () => getElement<HTMLInputElement>("teamA-score"),
  teamAPlayers: () => getElement<HTMLDivElement>("teamA-players"),
  teamALogoPreview: () => getElement<HTMLDivElement>("teamA-logo-preview"),
  teamALogoInput: () => getElement<HTMLInputElement>("teamA-logo-input"),
  teamBName: () => getElement<HTMLInputElement>("teamB-name"),
  teamBColor: () => getElement<HTMLInputElement>("teamB-color"),
  teamBColorHex: () => getElement<HTMLSpanElement>("teamB-color-hex"),
  teamBScore: () => getElement<HTMLInputElement>("teamB-score"),
  teamBPlayers: () => getElement<HTMLDivElement>("teamB-players"),
  teamBLogoPreview: () => getElement<HTMLDivElement>("teamB-logo-preview"),
  teamBLogoInput: () => getElement<HTMLInputElement>("teamB-logo-input"),
};

// ==========================================
// WebSocket Connection
// ==========================================

function updateConnectionStatus(connected: boolean): void {
  const dot = elements.statusDot();
  const status = elements.connectionStatus();

  if (dot) {
    // Use 'connected' class for neon glow effect
    dot.classList.toggle("connected", connected);
  }

  if (status) {
    status.textContent = connected ? "CONNECTED" : "DISCONNECTED";
    status.style.color = connected ? "#00FF66" : "";
  }
}

function connectWebSocket(): void {
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  console.log("🔌 Connecting to WebSocket...");
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("✅ WebSocket Connected");
    updateConnectionStatus(true);

    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);

      if (message.type === "STATE_UPDATE" && message.data) {
        currentState = message.data;
        renderUI();
      }
    } catch (err) {
      console.error("❌ Failed to parse WebSocket message:", err);
    }
  };

  ws.onclose = () => {
    console.log("🔌 WebSocket Disconnected");
    updateConnectionStatus(false);
    scheduleReconnect();
  };

  ws.onerror = (error) => {
    console.error("❌ WebSocket Error:", error);
    ws?.close();
  };
}

function scheduleReconnect(): void {
  if (!reconnectInterval) {
    reconnectInterval = window.setInterval(() => {
      console.log("🔄 Attempting to reconnect...");
      connectWebSocket();
    }, RECONNECT_DELAY);
  }
}

// ==========================================
// API Calls
// ==========================================

async function fetchInitialState(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/state`);
    if (response.ok) {
      currentState = await response.json();
      renderUI();
    }
  } catch (err) {
    console.error("❌ Failed to fetch initial state:", err);
  }
}

async function postAPI(endpoint: string, body: object): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch (err) {
    console.error(`❌ API call failed (${endpoint}):`, err);
    return false;
  }
}

// ==========================================
// UI Rendering
// ==========================================

function renderUI(): void {
  if (!currentState) return;

  const swapped = currentState.swapped || false;

  // When swapped: Left panel shows Team B, Right panel shows Team A
  // But we keep the original team identity (colors, borders) from the panel
  if (swapped) {
    renderTeamData("A", currentState.teams.B); // Left panel shows Team B data
    renderTeamData("B", currentState.teams.A); // Right panel shows Team A data
  } else {
    renderTeamData("A", currentState.teams.A); // Normal: Left = Team A
    renderTeamData("B", currentState.teams.B); // Normal: Right = Team B
  }

  // Update swap status
  const swapStatus = document.getElementById("swap-status");
  if (swapStatus) {
    swapStatus.textContent = swapped ? "🔀 สลับฝั่ง" : "ปกติ";
  }

  // Update panel titles based on swap state
  const teamATitle = document.querySelector(
    "#teamA-section .team-panel__title"
  );
  const teamBTitle = document.querySelector(
    "#teamB-section .team-panel__title"
  );

  if (teamATitle) {
    teamATitle.textContent = swapped ? "Team B" : "Team A";
  }
  if (teamBTitle) {
    teamBTitle.textContent = swapped ? "Team A" : "Team B";
  }

  // Update button labels and colors based on swap state
  const teamABtn = document.querySelector(
    '#teamA-section button[onclick*="saveTeam"]'
  ) as HTMLButtonElement;
  const teamBBtn = document.querySelector(
    '#teamB-section button[onclick*="saveTeam"]'
  ) as HTMLButtonElement;

  if (teamABtn) {
    teamABtn.textContent = swapped ? "UPDATE TEAM B" : "UPDATE TEAM A";
    // Set button color dynamically based on the team it represents
    // If swapped, Team A panel (Left) controls Team B. Team B color is currentState.teams.B.color
    // Wait, renderTeamData updates colorInput. The color passed to applyThemeColor is the source of truth for "current color".
    // But here we need to read it from state or DOM.
    // Easiest is to set it in applyThemeColor? No, that applies to section/card.
    // Let's set it here based on state.

    let btnColor = "#007AFF"; // Default Blue
    if (swapped) {
      btnColor = currentState.teams.B.color;
    } else {
      btnColor = currentState.teams.A.color;
    }

    // Remove old classes that force color
    teamABtn.classList.remove(
      "bg-blue-600",
      "hover:bg-blue-500",
      "bg-red-600",
      "hover:bg-red-500"
    );
    teamABtn.style.backgroundColor = btnColor;

    // Add hover effect via JS or assume simple CSS transition.
    // Since we can't easily add hover pseudo-state via inline style,
    // we might leave it or use a utility class that darkens on hover if available, or just set background.
    // For now, setting background is better than wrong color.

    // Also update shadow if possible
    const rgb = hexToRgb(btnColor);
    if (rgb) {
      teamABtn.style.boxShadow = `0 4px 6px -1px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
    }
  }

  if (teamBBtn) {
    teamBBtn.textContent = swapped ? "UPDATE TEAM A" : "UPDATE TEAM B";

    let btnColor = "#FF3B30"; // Default Red
    if (swapped) {
      btnColor = currentState.teams.A.color; // Right panel controls Team A
    } else {
      btnColor = currentState.teams.B.color;
    }

    teamBBtn.classList.remove(
      "bg-blue-600",
      "hover:bg-blue-500",
      "bg-red-600",
      "hover:bg-red-500"
    );
    teamBBtn.style.backgroundColor = btnColor;

    const rgb = hexToRgb(btnColor);
    if (rgb) {
      teamBBtn.style.boxShadow = `0 4px 6px -1px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
    }
  }
}

// Render team data into a specific panel (side = panel position, team = data to show)
function renderTeamData(side: "A" | "B", team: Team): void {
  const nameInput = side === "A" ? elements.teamAName() : elements.teamBName();
  const colorInput =
    side === "A" ? elements.teamAColor() : elements.teamBColor();
  const colorHex =
    side === "A" ? elements.teamAColorHex() : elements.teamBColorHex();
  const scoreInput =
    side === "A" ? elements.teamAScore() : elements.teamBScore();
  const playersContainer =
    side === "A" ? elements.teamAPlayers() : elements.teamBPlayers();

  if (nameInput) nameInput.value = team.name;
  if (colorInput) colorInput.value = team.color;
  if (colorHex) colorHex.textContent = team.color;
  if (scoreInput) scoreInput.value = String(team.score);

  // Render players
  if (playersContainer) {
    renderPlayers(side, team.players, playersContainer);
  }

  // Render logo preview
  // Render logo preview
  const logoPreview =
    side === "A" ? elements.teamALogoPreview() : elements.teamBLogoPreview();
  if (logoPreview) {
    if (team.logo) {
      // Determine logical team to use correct cachebuster
      let version = Date.now();
      if (currentState) {
        if (team === currentState.teams.A) version = logoVersions.A;
        else if (team === currentState.teams.B) version = logoVersions.B;
      }

      // Append version
      const logoUrl = team.logo.includes("?")
        ? `${team.logo}&v=${version}`
        : `${team.logo}?v=${version}`;

      // Display cropped logo - basically always contain because crop handles the aspect ratio
      logoPreview.innerHTML = `
                <div class="relative w-full h-full group">
                    <img src="${logoUrl}" alt="${team.name} Logo" class="w-full h-full object-contain" 
                         style="border-radius: var(--radius-md);">
                </div>`;
    } else {
      logoPreview.innerHTML = `
                <i class="ph-duotone ph-image logo-dropzone__icon"></i>
                <span class="logo-dropzone__text">Click to upload logo</span>
                <span class="logo-dropzone__hint">PNG, JPG, SVG (max 2MB)</span>
            `;
    }
  }

  // Apply theme color to section
  applyThemeColor(side, team.color);

  // Update color hex on change
  colorInput?.addEventListener("input", () => {
    if (colorHex) colorHex.textContent = colorInput.value;
  });
}

function applyThemeColor(side: "A" | "B", color: string): void {
  const section = document.getElementById(`team${side}-section`);
  const header = document.getElementById(`team${side}-header`);
  const accent = document.getElementById(`team${side}-accent`);
  const card = document.getElementById(`team${side}-card`);

  // Parse color to get RGB for shadow
  const rgb = hexToRgb(color);
  const shadowColor = rgb
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`
    : "rgba(100, 100, 100, 0.15)";

  if (section) {
    // Section A has border-right (separator), Section B has border-left (separator)
    // Keep this strictly Side Color (Blue/Red) to avoid confusion
    // if (side === 'A') {
    //     section.style.borderRightColor = color;
    // } else {
    //     section.style.borderLeftColor = color;
    // }
  }
  if (header) {
    // header.style.color = color;
  }
  if (accent) {
    // Do not change accent color - keep it as Side Identity (Blue/Red)
    // accent.style.backgroundColor = color;
  }
  if (card) {
    // Both cards have border-left in CSS
    card.style.borderLeftColor = color;
    card.style.boxShadow = `0 4px 6px -1px ${shadowColor}`;
  }

  // Apply color to roster items
  const rosterList = document.getElementById(`team${side}-players`);
  if (rosterList) {
    // renderPlayers generates elements with class 'player-card'
    const items = rosterList.querySelectorAll(
      ".player-card"
    ) as NodeListOf<HTMLElement>;
    items.forEach((item) => {
      item.style.borderLeftColor = color;
    });
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function renderPlayers(
  side: "A" | "B",
  players: Player[],
  container: HTMLDivElement
): void {
  const sideClass = side === "A" ? "player-card--a" : "player-card--b";

  container.innerHTML = players
    .map((player) => {
      // Hero image path (use ROV hero images with filename mapping)
      const heroImgPath = player.hero ? getHeroImagePath(player.hero) : "";
      const laneImgPath = player.lane
        ? `/lane/${encodeURIComponent(player.lane)}.jpg`
        : "";

      return `
    <div class="player-card ${sideClass}" 
         draggable="true" 
         data-side="${side}" 
         data-slot="${player.slot}"
         ondragstart="handleDragStart(event)"
         ondragend="handleDragEnd(event)"
         ondragover="handleDragOver(event)"
         ondrop="handleDrop(event)">
      
      <!-- Drag Handle -->
      <div class="player-card__drag">
        <i class="ph-bold ph-dots-six-vertical"></i>
      </div>
      
      <!-- Lane/Role -->
      <div class="player-card__role ${player.hero ? "" : "disabled"}" 
           onclick="handleLaneClick('${side}', ${player.slot}, ${player.hero ? "true" : "false"})"
           title="${player.lane || (player.hero ? "Select Lane" : "Select Hero first")}">
        ${
          laneImgPath
            ? `<img src="${laneImgPath}" alt="${escapeHtml(player.lane || "")}">`
            : '<i class="ph-duotone ph-map-pin"></i>'
        }
      </div>
      
      <!-- Name Input -->
      <div class="player-card__name">
        <input 
          type="text" 
          value="${escapeHtml(player.name)}" 
          onchange="updatePlayer('${side}', ${player.slot}, this.value)"
          placeholder="Player ${player.slot}"
        />
      </div>
      
      <!-- Hero Avatar -->
      <div class="player-card__hero ${player.hero ? "has-hero" : ""}" 
           onclick="openHeroPicker('${side}', ${player.slot})"
           title="${player.hero || "Select Hero"}">
        ${
          heroImgPath
            ? `<img src="${heroImgPath}" alt="${escapeHtml(player.hero || "")}">`
            : '<i class="ph-duotone ph-game-controller"></i>'
        }
      </div>
      
      <!-- Captain Toggle -->
      <button class="player-card__captain ${player.isCaptain ? "active" : ""}" 
              onclick="toggleCaptain('${side}', ${player.slot})"
              title="${player.isCaptain ? "Captain" : "Set as Captain"}">
        <i class="ph-${player.isCaptain ? "fill" : "duotone"} ph-crown"></i>
      </button>
    </div>
  `;
    })
    .join("");
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// Action Handlers (Exposed to Window)
// ==========================================

async function saveTeam(side: "A" | "B"): Promise<void> {
  const nameInput = side === "A" ? elements.teamAName() : elements.teamBName();
  const colorInput =
    side === "A" ? elements.teamAColor() : elements.teamBColor();

  if (!nameInput || !colorInput) return;

  // When swapped, left panel (A) contains Team B data, right panel (B) contains Team A data
  const swapped = currentState?.swapped || false;
  const actualSide = swapped ? (side === "A" ? "B" : "A") : side;

  const success = await postAPI("/api/team/update", {
    side: actualSide,
    name: nameInput.value,
    color: colorInput.value,
  });

  if (success) {
    console.log(`✅ Team ${actualSide} saved (panel ${side})`);
    // Sync changes back to loaded template if exists
    await syncTemplateAfterUpdate(actualSide);
  } else {
    console.error(`❌ Failed to save Team ${actualSide}`);
  }
}

async function adjustScore(side: "A" | "B", delta: number): Promise<void> {
  if (!currentState) return;

  // When swapped, left panel (A) contains Team B data, right panel (B) contains Team A data
  const swapped = currentState.swapped || false;
  const actualSide = swapped ? (side === "A" ? "B" : "A") : side;

  const team = currentState.teams[actualSide];
  const newScore = Math.max(0, team.score + delta);

  const success = await postAPI("/api/team/update", {
    side: actualSide,
    score: newScore,
  });

  if (success) {
    console.log(`✅ Score ${actualSide} updated: ${newScore} (panel ${side})`);
  } else {
    console.error(`❌ Failed to update score for Team ${actualSide}`);
  }
}

async function swapSides(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      const result = await response.json();
      updateSwapUI(result.swapped);
      console.log(
        `✅ Sides swapped: ${result.swapped ? "Team A → Right, Team B → Left" : "Normal"}`
      );
    } else {
      console.error("❌ Swap failed");
    }
  } catch (err) {
    console.error("❌ Swap error:", err);
  }
}

// Trigger transition animation
async function triggerTransition(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/transition/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      console.log("🎬 Transition triggered!");
    } else {
      console.error("❌ Transition trigger failed");
    }
  } catch (err) {
    console.error("❌ Transition error:", err);
  }
}

// Transition Logo Upload
let transitionLogoFile: File | null = null;

function handleTransitionLogoSelect(input: HTMLInputElement): void {
  previewTransitionLogo(input);
}

function previewTransitionLogo(input: HTMLInputElement): void {
  const file = input.files?.[0];
  if (!file) return;

  transitionLogoFile = file;
  const img = document.getElementById(
    "transition-logo-img"
  ) as HTMLImageElement;
  const placeholder = document.getElementById("transition-logo-placeholder");
  const status = document.getElementById("transition-logo-status");

  if (img && placeholder) {
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
      img.classList.remove("hidden");
      placeholder.classList.add("hidden");
    };
    reader.readAsDataURL(file);
  }

  if (status) {
    status.textContent = `📁 เลือก: ${file.name} → กด Upload`;
    status.className = "text-xs text-yellow-400 text-center";
  }
  console.log("📁 Transition logo selected:", file.name);
}

async function uploadTransitionLogo(): Promise<void> {
  const status = document.getElementById("transition-logo-status");

  if (!transitionLogoFile) {
    console.log("⚠️ No logo file selected");
    if (status) {
      status.textContent = "⚠️ กรุณาเลือกรูปก่อน!";
      status.className = "text-xs text-red-400 text-center";
    }
    return;
  }

  if (status) {
    status.textContent = "⏳ กำลังอัปโหลด...";
    status.className = "text-xs text-blue-400 text-center";
  }

  const formData = new FormData();
  formData.append("logo", transitionLogoFile);

  try {
    const response = await fetch(`${API_BASE}/api/transition/logo`, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Transition logo uploaded:", result.path);
      if (status) {
        status.textContent = "✅ อัปโหลดสำเร็จ!";
        status.className = "text-xs text-green-400 text-center";
      }
      transitionLogoFile = null;
    } else {
      console.error("❌ Failed to upload transition logo");
      if (status) {
        status.textContent = "❌ อัปโหลดล้มเหลว";
        status.className = "text-xs text-red-400 text-center";
      }
    }
  } catch (err) {
    console.error("❌ Transition logo upload error:", err);
    if (status) {
      status.textContent = "❌ เกิดข้อผิดพลาด";
      status.className = "text-xs text-red-400 text-center";
    }
  }
}

// Combined function: select and upload in one step
async function uploadTransitionLogoFromInput(
  input: HTMLInputElement
): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;

  const img = document.getElementById(
    "transition-logo-img"
  ) as HTMLImageElement;
  const placeholder = document.getElementById("transition-logo-placeholder");
  const status = document.getElementById("transition-logo-status");

  // Show preview immediately
  if (img && placeholder) {
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
      img.classList.remove("hidden");
      placeholder.classList.add("hidden");
    };
    reader.readAsDataURL(file);
  }

  // Update status
  if (status) status.textContent = "⏳ กำลังอัปโหลด...";

  const formData = new FormData();
  formData.append("logo", file);

  try {
    const response = await fetch(`${API_BASE}/api/transition/logo`, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Transition logo uploaded:", result.path);
      if (status) status.textContent = "✅ อัปโหลดสำเร็จ!";
    } else {
      console.error("❌ Failed to upload transition logo");
      if (status) status.textContent = "❌ อัปโหลดล้มเหลว";
    }
  } catch (err) {
    console.error("❌ Transition logo upload error:", err);
    if (status) status.textContent = "❌ เกิดข้อผิดพลาด";
  }
}

// Load current transition logo on page load
async function loadTransitionLogo(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/transition/logo`);
    if (response.ok) {
      const result = await response.json();
      if (result.path) {
        const img = document.getElementById(
          "transition-logo-img"
        ) as HTMLImageElement;
        const placeholder = document.getElementById(
          "transition-logo-placeholder"
        );
        if (img && placeholder) {
          img.src = result.path;
          img.classList.remove("hidden");
          placeholder.classList.add("hidden");
        }
      }
    }
  } catch (err) {
    console.log("No transition logo found");
  }
}

// ==========================================
// Lower Third Functions
// ==========================================

// Update Lower Third settings
async function updateLowerThird(): Promise<void> {
  const enabled = (
    document.getElementById("lower-third-enabled") as HTMLInputElement
  )?.checked;
  const title =
    (document.getElementById("lower-third-title") as HTMLInputElement)?.value ||
    "";

  const slots = [1, 2, 3].map((id) => ({
    id,
    enabled:
      (document.getElementById(`slot-${id}-enabled`) as HTMLInputElement)
        ?.checked ?? true,
    type: "text" as const,
    logoPath: "",
    text:
      (document.getElementById(`slot-${id}-text`) as HTMLInputElement)?.value ||
      "",
    label:
      (document.getElementById(`slot-${id}-text`) as HTMLInputElement)?.value ||
      "",
  }));

  try {
    const response = await fetch(`${API_BASE}/api/lower-third`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, title, slots }),
    });

    if (response.ok) {
      console.log("✅ Lower Third updated");
    } else {
      console.error("❌ Failed to update Lower Third");
    }
  } catch (err) {
    console.error("❌ Lower Third update error:", err);
  }
}

// Upload logo for specific slot
async function uploadSlotLogo(
  slotId: number,
  input: HTMLInputElement
): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("logo", file);

  try {
    const response = await fetch(
      `${API_BASE}/api/lower-third/slot/${slotId}/logo`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (response.ok) {
      console.log(`✅ Slot ${slotId} logo uploaded`);
    } else {
      console.error(`❌ Failed to upload slot ${slotId} logo`);
    }
  } catch (err) {
    console.error("❌ Slot logo upload error:", err);
  }
}

// Load Lower Third state on page load
async function loadLowerThird(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/lower-third`);
    if (response.ok) {
      const state = await response.json();

      // Update UI from state
      const enabledEl = document.getElementById(
        "lower-third-enabled"
      ) as HTMLInputElement;
      const titleEl = document.getElementById(
        "lower-third-title"
      ) as HTMLInputElement;

      if (enabledEl) enabledEl.checked = state.enabled;
      if (titleEl) titleEl.value = state.title || "";

      state.slots?.forEach(
        (slot: { id: number; enabled: boolean; text: string }) => {
          const slotEnabled = document.getElementById(
            `slot-${slot.id}-enabled`
          ) as HTMLInputElement;
          const slotText = document.getElementById(
            `slot-${slot.id}-text`
          ) as HTMLInputElement;

          if (slotEnabled) slotEnabled.checked = slot.enabled;
          if (slotText) slotText.value = slot.text || "";
        }
      );
    }
  } catch (err) {
    console.log("Failed to load Lower Third state");
  }
}

// ==========================================
// Settings Menu Functions
// ==========================================

function toggleSettingsMenu(): void {
  const menu = document.getElementById("settings-menu");
  if (menu) {
    // Always remove 'hidden' first otherwise it will override 'active' due to !important
    menu.classList.remove("hidden");
    menu.classList.toggle("active");
  }
}

// Switch between pages (Scoreboard / Broadcast)
let currentPage: string = "scoreboard";

function switchPage(page: string): void {
  currentPage = page;

  // Hide all pages by removing 'active'
  const pageScoreboard = document.getElementById("page-scoreboard");
  const pageBroadcast = document.getElementById("page-broadcast");

  if (pageScoreboard) pageScoreboard.classList.remove("active");
  if (pageBroadcast) pageBroadcast.classList.remove("active");

  // Show selected page by adding 'active'
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.add("active");

  // Update nav items active state
  const navScoreboard = document.getElementById("nav-scoreboard");
  const navBroadcast = document.getElementById("nav-broadcast");

  navScoreboard?.classList.toggle("active", page === "scoreboard");
  navBroadcast?.classList.toggle("active", page === "broadcast");

  // Close the menu after switching
  const menu = document.getElementById("settings-menu");
  if (menu) menu.classList.remove("active");

  console.log(`📄 Switched to page: ${page}`);
}

// Close menu when clicking outside
document.addEventListener("click", (e) => {
  const menu = document.getElementById("settings-menu");
  const hamburger = document.getElementById("hamburger-btn");
  if (
    menu &&
    hamburger &&
    !menu.contains(e.target as Node) &&
    !hamburger.contains(e.target as Node)
  ) {
    menu.classList.add("hidden");
  }
});

let mainLogoFile: File | null = null;

function handleMainLogoSelect(input: HTMLInputElement): void {
  const file = input.files?.[0];
  if (!file) return;

  mainLogoFile = file;
  const preview = document.getElementById("main-logo-preview");
  if (preview) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target?.result}" class="w-full h-full object-contain">`;
    };
    reader.readAsDataURL(file);
  }
}

async function saveGeneralSettings(): Promise<void> {
  const eventName =
    (document.getElementById("event-name") as HTMLInputElement)?.value || "";
  const transitionColor =
    (document.getElementById("transition-color") as HTMLInputElement)?.value ||
    "#202224";

  console.log("💾 Saving general settings:", { eventName, transitionColor });

  // Save to localStorage for now
  localStorage.setItem("esport-event-name", eventName);
  localStorage.setItem("esport-transition-color", transitionColor);

  // If logo file selected, upload it
  if (mainLogoFile) {
    const formData = new FormData();
    formData.append("logo", mainLogoFile);
    formData.append("type", "main");

    try {
      const response = await fetch(`${API_BASE}/api/settings/logo`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        console.log("✅ Main logo uploaded");
      }
    } catch (err) {
      console.error("❌ Logo upload error:", err);
    }
  }

  // Close menu
  toggleSettingsMenu();
  console.log("✅ Settings saved!");
}

// Current open panel type
let currentSettingsPanel: string = "";

// Open full settings panel
function openSettingsPanel(panelType: string): void {
  const modal = document.getElementById("settings-modal");
  const title = document.getElementById("settings-modal-title");
  const content = document.getElementById("settings-modal-content");

  if (!modal || !title || !content) return;

  currentSettingsPanel = panelType;
  toggleSettingsMenu(); // Close dropdown

  // Set title and content based on panel type
  switch (panelType) {
    case "general":
      title.innerHTML = "⚙️ General Settings";
      content.innerHTML = getGeneralSettingsContent();
      break;
    case "overlays":
      title.innerHTML = "🖥️ Overlay URLs";
      content.innerHTML = getOverlayURLsContent();
      break;
    case "sponsors":
      title.innerHTML = "🏷️ Sponsors";
      content.innerHTML = '<p class="text-gray-500">Coming Soon...</p>';
      break;
    default:
      return;
  }

  modal.classList.remove("hidden");
  loadPanelData(panelType);
}

function closeSettingsPanel(): void {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.classList.add("hidden");
  currentSettingsPanel = "";
}

function getGeneralSettingsContent(): string {
  return `
        <div class="space-y-6">
            <!-- Event/Tournament Name -->
            <div>
                <label class="text-sm text-gray-400 uppercase block mb-2 font-medium">ชื่องาน/ทัวร์นาเมนต์</label>
                <input type="text" id="event-name" placeholder="Enter event name..."
                    class="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20">
            </div>

            <!-- Main Logo Upload -->
            <div>
                <label class="text-sm text-gray-400 uppercase block mb-2 font-medium">โลโก้หลัก (สำหรับ Transition)</label>
                <div class="flex items-center gap-4">
                    <div id="main-logo-preview"
                        class="w-24 h-24 bg-gray-800 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden">
                        <span class="text-gray-500 text-sm">No Logo</span>
                    </div>
                    <div class="flex-1">
                        <input type="file" id="main-logo-input" accept="image/*" class="hidden"
                            onchange="handleMainLogoSelect(this)">
                        <button onclick="document.getElementById('main-logo-input').click()"
                            class="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg transition flex items-center justify-center gap-2">
                            <span>📁</span> Choose Logo
                        </button>
                        <p class="text-xs text-gray-500 mt-2">PNG, JPG, WEBP, SVG (max 2MB)</p>
                    </div>
                </div>
            </div>

            <!-- Transition Theme Colors -->
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-sm text-gray-400 uppercase block mb-2 font-medium">สีธีม Transition</label>
                    <div class="flex items-center gap-3 bg-gray-800 rounded-lg p-3 border border-gray-700">
                        <input type="color" id="transition-color" value="#202224"
                            class="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-600">
                        <span class="text-sm text-gray-300 font-mono" id="transition-color-hex">#202224</span>
                    </div>
                </div>
                <div>
                    <label class="text-sm text-gray-400 uppercase block mb-2 font-medium">สีรอง</label>
                    <div class="flex items-center gap-3 bg-gray-800 rounded-lg p-3 border border-gray-700">
                        <input type="color" id="alt-color" value="#ffffff"
                            class="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-600">
                        <span class="text-sm text-gray-300 font-mono" id="alt-color-hex">#ffffff</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getOverlayURLsContent(): string {
  const baseUrl = window.location.origin;
  return `
        <div class="space-y-4">
            <p class="text-sm text-gray-400 mb-4">คัดลอก URL เหล่านี้ไปใช้ใน OBS Browser Source</p>
            
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <label class="text-xs text-gray-400 uppercase block mb-2">ROV Scoreboard Overlay</label>
                <div class="flex items-center gap-2">
                    <input type="text" value="${baseUrl}/overlay-rov.html" readonly
                        class="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono">
                    <button onclick="copyToClipboard('${baseUrl}/overlay-rov.html')"
                        class="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-white text-sm transition">Copy</button>
                </div>
            </div>
            
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <label class="text-xs text-gray-400 uppercase block mb-2">Transition Stinger</label>
                <div class="flex items-center gap-2">
                    <input type="text" value="${baseUrl}/transition.html" readonly
                        class="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono">
                    <button onclick="copyToClipboard('${baseUrl}/transition.html')"
                        class="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-white text-sm transition">Copy</button>
                </div>
            </div>

            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <label class="text-xs text-gray-400 uppercase block mb-2">✨ Versus Screen (Full)</label>
                <div class="flex items-center gap-2">
                    <input type="text" value="${baseUrl}/versus.html" readonly
                        class="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono">
                    <button onclick="copyToClipboard('${baseUrl}/versus.html')"
                        class="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-white text-sm transition">Copy</button>
                    <button onclick="window.open('${baseUrl}/versus.html', '_blank', 'width=1920,height=1080')"
                        class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-white text-sm transition" title="Open Preview">Open</button>
                </div>
            </div>
        </div>
    `;
}

function loadPanelData(panelType: string): void {
  if (panelType === "general") {
    const eventName = localStorage.getItem("esport-event-name") || "";
    const transitionColor =
      localStorage.getItem("esport-transition-color") || "#202224";
    const altColor = localStorage.getItem("esport-alt-color") || "#ffffff";

    setTimeout(() => {
      const eventInput = document.getElementById(
        "event-name"
      ) as HTMLInputElement;
      const colorInput = document.getElementById(
        "transition-color"
      ) as HTMLInputElement;
      const colorHex = document.getElementById("transition-color-hex");
      const altInput = document.getElementById("alt-color") as HTMLInputElement;
      const altHex = document.getElementById("alt-color-hex");

      if (eventInput) eventInput.value = eventName;
      if (colorInput) {
        colorInput.value = transitionColor;
        colorInput.addEventListener("input", () => {
          if (colorHex) colorHex.textContent = colorInput.value;
        });
      }
      if (colorHex) colorHex.textContent = transitionColor;
      if (altInput) {
        altInput.value = altColor;
        altInput.addEventListener("input", () => {
          if (altHex) altHex.textContent = altInput.value;
        });
      }
      if (altHex) altHex.textContent = altColor;
    }, 50);
  }
}

function saveCurrentSettings(): void {
  if (currentSettingsPanel === "general") {
    saveGeneralSettings();
  }
  closeSettingsPanel();
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).then(() => {
    console.log("📋 Copied to clipboard:", text);
  });
}

// Load saved settings on init
function loadGeneralSettings(): void {
  // Settings are now loaded when panel opens
}

function updateSwapUI(swapped: boolean): void {
  const swapStatus = document.getElementById("swap-status");

  if (swapStatus) {
    swapStatus.textContent = swapped ? "🔀 สลับฝั่ง" : "ปกติ";
  }

  // Re-render UI with new swap state
  if (currentState) {
    currentState.swapped = swapped;
    renderUI();
  }
}

async function updatePlayer(
  side: "A" | "B",
  slot: number,
  name: string
): Promise<void> {
  const success = await postAPI("/api/player/update", {
    side,
    slot,
    name,
  });

  if (success) {
    console.log(`✅ Player ${slot} of Team ${side} updated`);
  } else {
    console.error(`❌ Failed to update player ${slot} of Team ${side}`);
  }
}

async function handleLogoSelect(
  side: "A" | "B",
  input: HTMLInputElement
): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;

  // Validate file size (max 2MB)
  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    alert("File too large! Maximum size is 2MB.");
    input.value = "";
    return;
  }

  // Validate file type
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
    "image/gif",
  ];
  if (!allowedTypes.includes(file.type)) {
    alert("Invalid file type! Allowed: PNG, JPG, WEBP, SVG, GIF");
    input.value = "";
    return;
  }

  // When swapped, panel A contains Team B data, panel B contains Team A data
  const swapped = currentState?.swapped || false;
  const actualSide = swapped ? (side === "A" ? "B" : "A") : side;

  // Open Crop Modal instead of direct upload
  openCropModal(file, actualSide);
  input.value = "";
}

// Crop State
let cropImage: HTMLImageElement | null = null;
let cropCanvas: HTMLCanvasElement | null = null;
let cropCtx: CanvasRenderingContext2D | null = null;
let cropScale = 1;
let cropOffsetX = 0;
let cropOffsetY = 0;
let isDragging = false;
let lastX = 0;
let lastY = 0;
let currentCropSide: "A" | "B" | null = null;

function openCropModal(file: File, side: "A" | "B"): void {
  const modal = document.getElementById("crop-modal");
  cropCanvas = document.getElementById("crop-canvas") as HTMLCanvasElement;
  const zoomInput = document.getElementById("crop-zoom") as HTMLInputElement;

  if (!modal || !cropCanvas || !zoomInput) return;

  currentCropSide = side;
  cropCtx = cropCanvas.getContext("2d");

  // Reset state
  cropScale = 1;
  cropOffsetX = 0;
  cropOffsetY = 0;
  zoomInput.value = "1";

  // Load Image
  const reader = new FileReader();
  reader.onload = (e) => {
    cropImage = new Image();
    cropImage.onload = () => {
      if (!cropCanvas || !cropImage) return;

      // Set fixed canvas size (e.g., 600x300 for 2:1 ratio)
      // Match the container ratio roughly. Let's say 400x200 for good quality.
      cropCanvas.width = 400;
      cropCanvas.height = 400;

      // Initial center
      const scaleX = cropCanvas.width / cropImage.width;
      const scaleY = cropCanvas.height / cropImage.height;
      // "Fit" initially - use smaller scale
      const initialScale = Math.max(scaleX, scaleY);

      // Or "Fill" initially? User prefers crop, likely fill.
      // Let's start with "Contain" (Fit) so they see whole image, then they zoom.
      // Actually, let's start with a scale that fills at least one dimension perfectly.

      cropScale = initialScale;
      // Center image
      cropOffsetX = (cropCanvas.width - cropImage.width * cropScale) / 2;
      cropOffsetY = (cropCanvas.height - cropImage.height * cropScale) / 2;

      drawCrop();
      modal.classList.remove("hidden");

      // Add Listeners
      cropCanvas.addEventListener("mousedown", startDrag);
      cropCanvas.addEventListener("mousemove", drag);
      cropCanvas.addEventListener("mouseup", endDrag);
      cropCanvas.addEventListener("mouseleave", endDrag);
      // Wheel zoom
      cropCanvas.addEventListener("wheel", handleWheel);
    };
    cropImage.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

function closeCropModal(): void {
  const modal = document.getElementById("crop-modal");
  if (modal) modal.classList.add("hidden");
  cropImage = null;
  currentCropSide = null;
}

function updateCropZoom(): void {
  const zoomInput = document.getElementById("crop-zoom") as HTMLInputElement;
  if (!zoomInput || !cropImage || !cropCanvas) return;

  // Zoom relative to center would be nice, but simple scale is okay for now.
  // Better: maintain center point.

  const newScale = parseFloat(zoomInput.value);
  // Adjust offsets to keep center?
  // Simplified: just update scale and let user pan.
  // But multiplying by base scale.

  // We need a base scale to reference.
  // Let's assume zoomInput is a multiplier on the *initial* fit scale?
  // Or just a raw multiplier?
  // Let's use raw multiplier logic relative to image size.
  // Re-calculate based on slider.

  // To smooth experience:
  // oldScale
  const oldScale = cropScale;

  // Calculate base fit scale again
  const scaleX = cropCanvas.width / cropImage.width;
  const scaleY = cropCanvas.height / cropImage.height;
  const baseScale = Math.min(scaleX, scaleY); // Fit scale

  cropScale = baseScale * newScale;

  // Maintain center
  // CenterX of canvas in image coords
  // This is complex to do perfectly without more state.
  // Simple approach: Center image on canvas when zooming if not dragged?
  // Let's just redraw.
  drawCrop();
}

function startDrag(e: MouseEvent): void {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
}

function drag(e: MouseEvent): void {
  if (!isDragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  cropOffsetX += dx;
  cropOffsetY += dy;
  drawCrop();
}

function endDrag(): void {
  isDragging = false;
}

function handleWheel(e: WheelEvent): void {
  e.preventDefault();
  const zoomInput = document.getElementById("crop-zoom") as HTMLInputElement;
  if (!zoomInput) return;

  let val = parseFloat(zoomInput.value);
  if (e.deltaY < 0) val += 0.1;
  else val -= 0.1;

  val = Math.max(1, Math.min(3, val));
  zoomInput.value = val.toString();
  updateCropZoom();
}

function drawCrop(): void {
  if (!cropCtx || !cropCanvas || !cropImage) return;

  // Clear
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);

  // Draw background
  cropCtx.fillStyle = "#111";
  cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

  // Save context for clipping
  cropCtx.save();

  // Draw Image
  cropCtx.drawImage(
    cropImage,
    cropOffsetX,
    cropOffsetY,
    cropImage.width * cropScale,
    cropImage.height * cropScale
  );

  // Draw Overlay: Semi-transparent dark outside the circle
  cropCtx.restore(); // Restore to draw overlay on top

  cropCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
  cropCtx.beginPath();
  // Exterior of circle
  cropCtx.rect(0, 0, cropCanvas.width, cropCanvas.height);
  // Cut out circle
  cropCtx.arc(
    cropCanvas.width / 2,
    cropCanvas.height / 2,
    cropCanvas.width / 2,
    0,
    Math.PI * 2,
    true
  );
  cropCtx.fill();

  // Draw Circle Border
  cropCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  cropCtx.lineWidth = 2;
  cropCtx.beginPath();
  cropCtx.arc(
    cropCanvas.width / 2,
    cropCanvas.height / 2,
    cropCanvas.width / 2 - 2,
    0,
    Math.PI * 2
  );
  cropCtx.stroke();
}

function confirmCrop(): void {
  if (!cropCanvas || !currentCropSide) return;

  cropCanvas.toBlob(async (blob) => {
    if (blob && currentCropSide) {
      const file = new File([blob], "logo_cropped.png", { type: "image/png" });
      await uploadLogo(currentCropSide, file);
      closeCropModal();
    }
  }, "image/png");
}

async function uploadLogo(side: "A" | "B", file: File): Promise<void> {
  const formData = new FormData();
  formData.append("logo", file);
  formData.append("side", side);

  try {
    const response = await fetch(`${API_BASE}/api/logo/upload`, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Logo for Team ${side} uploaded successfully`, result);

      // Update logo version to force refresh
      logoVersions[side] = Date.now();

      // Update local state is optional if WS sends update, but good for immediate feedback.
      // However, WS update might not have the version param, so relying on logoVersions global is better.
      if (currentState) {
        const logoPath =
          result.logoPath ||
          result.path ||
          (side === "A" ? "/logos/team-a.png" : "/logos/team-b.png");
        if (side === "A") currentState.teams.A.logo = logoPath;
        else currentState.teams.B.logo = logoPath;
        renderUI();
      }
    } else {
      const error = await response.text();
      console.error(`❌ Failed to upload logo: ${error}`);
      alert(`Upload failed: ${error}`);
    }
  } catch (err) {
    console.error("❌ Logo upload error:", err);
    alert("Failed to upload logo. Please try again.");
  }
}

// Color picker state
let activePickerSide: "A" | "B" | null = null;
let activePickerPanelSide: "A" | "B" | null = null;
let pickerOverlay: HTMLDivElement | null = null;

async function pickScreenColor(side: "A" | "B"): Promise<void> {
  // Try EyeDropper API (Chrome/Edge)
  if ("EyeDropper" in window) {
    try {
      // @ts-ignore - EyeDropper is not in TypeScript types yet
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      // When swapped, panel A contains Team B data
      const swapped = currentState?.swapped || false;
      const actualSide = swapped ? (side === "A" ? "B" : "A") : side;
      applyColor(actualSide, result.sRGBHex, side);
    } catch (err) {
      console.log("Color picking cancelled");
    }
  } else {
    alert(
      "ฟีเจอร์นี้รองรับเฉพาะ Chrome/Edge บน Desktop\n(กรุณาใช้ Color Picker ปกติ หรือดูดสีจากโลโก้แทน)"
    );
  }
}

async function pickLogoColor(side: "A" | "B"): Promise<void> {
  const logoPreview =
    side === "A" ? elements.teamALogoPreview() : elements.teamBLogoPreview();
  const logoImg = logoPreview?.querySelector("img") as HTMLImageElement | null;

  if (!logoImg || logoImg.style.display === "none") {
    alert("กรุณาอัพโหลดโลโก้ก่อน เพื่อดูดสีจากโลโก้");
    return;
  }

  // When swapped, panel A contains Team B data
  const swapped = currentState?.swapped || false;
  const actualSide = swapped ? (side === "A" ? "B" : "A") : side;

  // Open pixel picker modal with both actual and panel side
  openPixelPickerModal(actualSide, side, logoImg.src);
}

function openPixelPickerModal(
  actualSide: "A" | "B",
  panelSide: "A" | "B",
  imageSrc: string
): void {
  activePickerSide = actualSide;
  activePickerPanelSide = panelSide;

  // Create overlay
  pickerOverlay = document.createElement("div");
  pickerOverlay.id = "pixel-picker-overlay";
  pickerOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        cursor: crosshair;
    `;

  // Create header
  const header = document.createElement("div");
  header.style.cssText = `
        color: white;
        font-size: 18px;
        margin-bottom: 20px;
        text-align: center;
    `;
  header.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">🎨 คลิกเลือกสีจากโลโก้ Team ${panelSide}</div>
        <div style="font-size: 14px; color: #888;">กด ESC หรือคลิกนอกภาพเพื่อยกเลิก</div>
    `;

  // Create color preview
  const colorPreview = document.createElement("div");
  colorPreview.id = "picker-color-preview";
  colorPreview.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
        padding: 10px 20px;
        background: #1f2937;
        border-radius: 8px;
    `;
  colorPreview.innerHTML = `
        <div id="picker-color-box" style="width: 40px; height: 40px; border-radius: 8px; border: 2px solid white; background: #888;"></div>
        <div id="picker-color-hex" style="font-family: monospace; font-size: 18px; color: white;">#------</div>
    `;

  // Create canvas container
  const canvasContainer = document.createElement("div");
  canvasContainer.style.cssText = `
        border: 3px solid #3b82f6;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 0 50px rgba(59, 130, 246, 0.3);
    `;

  // Create canvas for pixel picking
  const canvas = document.createElement("canvas");
  canvas.id = "picker-canvas";
  canvas.style.cssText = `
        max-width: 400px;
        max-height: 400px;
        cursor: crosshair;
        image-rendering: pixelated;
    `;

  // Load image to canvas
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const size = Math.min(400, Math.max(img.width, img.height, 200));
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Draw image centered
    const scale = Math.min(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (size - w) / 2;
    const y = (size - h) / 2;

    ctx.fillStyle = "#374151";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, x, y, w, h);
  };
  img.src = imageSrc;

  // Mouse move - show color preview
  canvas.addEventListener("mousemove", (e) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

    const colorBox = document.getElementById("picker-color-box");
    const colorHex = document.getElementById("picker-color-hex");
    if (colorBox) colorBox.style.background = hex;
    if (colorHex) colorHex.textContent = hex;
  });

  // Click - select color
  canvas.addEventListener("click", (e) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !activePickerSide || !activePickerPanelSide) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

    applyColor(activePickerSide, hex, activePickerPanelSide);
    closePixelPickerModal();
  });

  // Click outside to close
  pickerOverlay.addEventListener("click", (e) => {
    if (e.target === pickerOverlay) {
      closePixelPickerModal();
    }
  });

  // ESC to close
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closePixelPickerModal();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  canvasContainer.appendChild(canvas);
  pickerOverlay.appendChild(header);
  pickerOverlay.appendChild(colorPreview);
  pickerOverlay.appendChild(canvasContainer);
  document.body.appendChild(pickerOverlay);
}

function closePixelPickerModal(): void {
  if (pickerOverlay) {
    pickerOverlay.remove();
    pickerOverlay = null;
  }
  activePickerSide = null;
  activePickerPanelSide = null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function applyColor(
  actualSide: "A" | "B",
  color: string,
  panelSide?: "A" | "B"
): void {
  // panelSide is the UI panel, actualSide is the real team (after swap adjustment)
  // If panelSide not provided, assume no swap adjustment needed for UI
  const uiSide = panelSide || actualSide;
  const colorInput =
    uiSide === "A" ? elements.teamAColor() : elements.teamBColor();
  const colorHex =
    uiSide === "A" ? elements.teamAColorHex() : elements.teamBColorHex();

  if (colorInput) {
    colorInput.value = color;
    colorInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (colorHex) {
    colorHex.textContent = color;
  }

  console.log(
    `🎨 Picked color for Team ${actualSide} (panel ${uiSide}): ${color}`
  );
}

function toggleLogoFit(side: "A" | "B"): void {
  if (!currentState) return;

  const swapped = currentState.swapped || false;
  let targetTeam: Team;

  // Determine which team is currently in the panel 'side'
  if (side === "A") {
    targetTeam = swapped ? currentState.teams.B : currentState.teams.A;
  } else {
    targetTeam = swapped ? currentState.teams.A : currentState.teams.B;
  }

  targetTeam.logoFit = targetTeam.logoFit === "cover" ? "contain" : "cover";
  renderUI();
}

// ==========================================
// Expose Functions to Window
// ==========================================

declare global {
  interface Window {
    saveTeam: typeof saveTeam;
    adjustScore: typeof adjustScore;
    updatePlayer: typeof updatePlayer;
    handleLogoSelect: typeof handleLogoSelect;
    pickScreenColor: typeof pickScreenColor;
    pickLogoColor: typeof pickLogoColor;
    openHeroPicker: typeof openHeroPicker;
    swapSides: typeof swapSides;
    updateSwapUI: typeof updateSwapUI;
    triggerTransition: typeof triggerTransition;
    toggleSettingsMenu: typeof toggleSettingsMenu;
    handleMainLogoSelect: typeof handleMainLogoSelect;
    saveGeneralSettings: typeof saveGeneralSettings;
    openSettingsPanel: typeof openSettingsPanel;
    closeSettingsPanel: typeof closeSettingsPanel;
    saveCurrentSettings: typeof saveCurrentSettings;
    copyToClipboard: typeof copyToClipboard;
    switchPage: typeof switchPage;
    handleTransitionLogoSelect: typeof handleTransitionLogoSelect;
    uploadTransitionLogo: typeof uploadTransitionLogo;
    uploadTransitionLogoFromInput: typeof uploadTransitionLogoFromInput;
    previewTransitionLogo: typeof previewTransitionLogo;
    updateLowerThird: typeof updateLowerThird;
    uploadSlotLogo: typeof uploadSlotLogo;
    loadLowerThird: typeof loadLowerThird;
    closeCropModal: typeof closeCropModal;
    confirmCrop: typeof confirmCrop;
    updateCropZoom: typeof updateCropZoom;
  }
}

window.saveTeam = saveTeam;
window.adjustScore = adjustScore;
window.updatePlayer = updatePlayer;
window.handleLogoSelect = handleLogoSelect;
window.closeCropModal = closeCropModal;
window.confirmCrop = confirmCrop;
window.updateCropZoom = updateCropZoom;
window.pickScreenColor = pickScreenColor;
window.pickLogoColor = pickLogoColor;
window.openHeroPicker = openHeroPicker;
window.swapSides = swapSides;
window.updateSwapUI = updateSwapUI;
window.triggerTransition = triggerTransition;
window.toggleSettingsMenu = toggleSettingsMenu;
window.handleMainLogoSelect = handleMainLogoSelect;
window.saveGeneralSettings = saveGeneralSettings;
window.openSettingsPanel = openSettingsPanel;
window.closeSettingsPanel = closeSettingsPanel;
window.saveCurrentSettings = saveCurrentSettings;
window.copyToClipboard = copyToClipboard;
window.switchPage = switchPage;
window.handleTransitionLogoSelect = handleTransitionLogoSelect;
window.uploadTransitionLogo = uploadTransitionLogo;
window.uploadTransitionLogoFromInput = uploadTransitionLogoFromInput;
window.previewTransitionLogo = previewTransitionLogo;
window.updateLowerThird = updateLowerThird;
window.uploadSlotLogo = uploadSlotLogo;
window.loadLowerThird = loadLowerThird;

// Load general settings on startup
setTimeout(loadGeneralSettings, 100);
setTimeout(loadLowerThird, 200);

// ==========================================
// Hero Picker Modal
// ==========================================

// ROV Heroes list - Updated to match actual image files
const HEROES = [
  "Airi",
  "Aleister",
  "Alice",
  "Allain",
  "Amily",
  "Annette",
  "Aoi",
  "Arduin",
  "Arum",
  "Astrid",
  "Ata",
  "Aya",
  "Baldum",
  "Bijan",
  "Billow",
  "Biron",
  "Bolt Baron",
  "Bonnie",
  "Bright",
  "Butterfly",
  "Capheny",
  "Celica",
  "Charlotte",
  "Chaugnar",
  "Cresht",
  "D'Arcy",
  "Dextra",
  "Diao Chan",
  "Dirak",
  "Dolia",
  "Edras",
  "Eland'orr",
  "Elsu",
  "Enzo",
  "Erin",
  "Errol",
  "Fennik",
  "Florentino",
  "Gildur",
  "Goverra",
  "Grakk",
  "Hayate",
  "Heino",
  "Helen",
  "Iggy",
  "Ignis",
  "Ilumia",
  "Ishar",
  "Jinna",
  "Kahlii",
  "Kaine",
  "Keera",
  "Kil'Groth",
  "Kriknak",
  "Krixi",
  "Krizzix",
  "Lauriel",
  "Laville",
  "Liliana",
  "Lindis",
  "Lorion",
  "Lu Bu",
  "Lumburr",
  "Maloch",
  "Marja",
  "Max",
  "Mganga",
  "Mina",
  "Ming",
  "Moren",
  "Mortos",
  "Murad",
  "Nakroth",
  "Natalya",
  "Omega",
  "Omen",
  "Ormarr",
  "Paine",
  "Payna",
  "Preyta",
  "Qi",
  "Quillen",
  "Raz",
  "Riktor",
  "Rouie",
  "Rourke",
  "Roxie",
  "Ryoma",
  "Sephera",
  "Sinestrea",
  "Skud",
  "Slimz",
  "Stuart",
  "Superman",
  "Taara",
  "Tachi",
  "TeeMee",
  "Teeri",
  "Tel'Annas",
  "Thane",
  "The Flash",
  "Thorne",
  "Toro",
  "Tulen",
  "Valhein",
  "Veera",
  "Veres",
  "Violet",
  "Volkath",
  "Wisp",
  "Wiro",
  "Wonder Woman",
  "WuKong",
  "Xeniel",
  "Y'bneth",
  "Yan",
  "Yena",
  "Yorn",
  "Yue",
  "Zanis",
  "Zata",
  "Zephys",
  "Zill",
  "Zip",
  "Zuka",
];

// Heroes with special filenames (map hero name to actual filename)
const HERO_FILE_MAP: Record<string, { name: string; ext: string }> = {
  // Different filename (with dash or number)
  Aleister: { name: "Aleister-3", ext: "webp" },
  Mortos: { name: "Mortos-3", ext: "webp" },
  Roxie: { name: "Roxie-2", ext: "webp" },
  // Different extension
  Edras: { name: "Edras", ext: "png" },
  Goverra: { name: "Goverra", ext: "jpg" },
  // Space to underscore
  "Bolt Baron": { name: "Bolt_Baron", ext: "webp" },
  "Diao Chan": { name: "Diao_Chan", ext: "webp" },
  "Lu Bu": { name: "Lu_Bu", ext: "webp" },
  "The Flash": { name: "The_Flash", ext: "webp" },
  "Wonder Woman": { name: "Wonder_Woman", ext: "webp" },
  // Apostrophe removed
  "D'Arcy": { name: "DArcy", ext: "webp" },
  "Eland'orr": { name: "Elandorr", ext: "webp" },
  "Kil'Groth": { name: "KilGroth", ext: "webp" },
  "Tel'Annas": { name: "TelAnnas", ext: "webp" },
  "Y'bneth": { name: "Ybneth", ext: "webp" },
};

// Updated for PNG assets (standardized)
function getHeroImagePath(heroName: string): string {
  // Standardize: "Lu Bu" -> "Lu_Bu", "D'Arcy" -> "D'Arcy" (file has quote)
  let formatted = heroName.trim();
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  // Check specific manual overrides if needed (e.g. for files that don't match simple logic)
  // But D'Arcy.png exists.
  // Replace spaces with underscores
  formatted = formatted.replace(/\s+/g, "_");

  return `/src/ROV/${formatted}.png`;
}

let heroPickerOverlay: HTMLDivElement | null = null;
let heroPickerSide: "A" | "B" | null = null;
let heroPickerSlot: number | null = null;

function openHeroPicker(side: "A" | "B", slot: number): void {
  heroPickerSide = side;
  heroPickerSlot = slot;

  // Create overlay
  heroPickerOverlay = document.createElement("div");
  heroPickerOverlay.id = "hero-picker-overlay";
  heroPickerOverlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;

  // Create modal container
  const modal = document.createElement("div");
  modal.style.cssText = `
        background: var(--color-bg-elevated, #1c1c1e);
        border-radius: 20px;
        width: 100%;
        max-width: 800px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
    `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
  header.innerHTML = `
        <h2 style="color: var(--color-text-primary, #f5f5f7); font-size: 1.25rem; font-weight: 600; margin: 0;">
            <i class="ph-duotone ph-game-controller" style="color: var(--color-accent, #0a84ff); margin-right: 8px;"></i>
            Select Hero - Team ${side} Player ${slot}
        </h2>
        <button id="hero-picker-close" style="
            width: 32px; height: 32px; border-radius: 50%;
            background: rgba(255, 255, 255, 0.1); border: none;
            color: var(--color-text-secondary, #a1a1a6); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.25rem;
        ">
            <i class="ph-bold ph-x"></i>
        </button>
    `;

  // Search input
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search hero...";
  searchInput.style.cssText = `
        margin: 16px 24px;
        padding: 12px 16px;
        font-size: 1rem;
        color: var(--color-text-primary, #f5f5f7);
        background: var(--color-bg-tertiary, #2c2c2e);
        border: 1px solid var(--color-border, #38383a);
        border-radius: 12px;
        outline: none;
    `;

  // Hero grid container
  const gridContainer = document.createElement("div");
  gridContainer.id = "hero-grid";
  gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
        gap: 12px;
        padding: 0 24px 24px;
        overflow-y: auto;
        max-height: 50vh;
    `;

  // Render heroes with images
  const renderHeroes = (filter: string = "") => {
    const filteredHeroes = filter
      ? HEROES.filter((h) => h.toLowerCase().includes(filter.toLowerCase()))
      : HEROES;

    gridContainer.innerHTML = filteredHeroes
      .map(
        (hero) => `
            <button 
                data-hero-name="${hero.replace(/"/g, "&quot;")}"
                onclick="selectHero(this.dataset.heroName)"
                style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    padding: 8px;
                    background: var(--color-bg-tertiary, #2c2c2e);
                    border: 2px solid transparent;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                "
                onmouseover="this.style.borderColor='var(--color-accent, #0a84ff)'; this.style.transform='scale(1.05)';"
                onmouseout="this.style.borderColor='transparent'; this.style.transform='scale(1)';"
                title="${hero.replace(/"/g, "&quot;")}"
            >
                <img 
                    src="${getHeroImagePath(hero)}" 
                    alt="${hero.replace(/"/g, "&quot;")}"
                    style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; background: #1a1a1a;"
                    onerror="if (this.src.endsWith('.png')) { this.src = this.src.replace('.png', '.webp'); } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }"
                >
                <div style="display: none; width: 60px; height: 60px; border-radius: 8px; background: var(--color-bg-secondary, #1c1c1e); align-items: center; justify-content: center;">
                    <i class="ph-duotone ph-game-controller" style="font-size: 1.5rem; color: var(--color-text-tertiary, #636366);"></i>
                </div>
                <span style="
                    font-size: 0.7rem;
                    color: var(--color-text-secondary, #a1a1a6);
                    text-align: center;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    width: 100%;
                ">${hero}</span>
            </button>
        `
      )
      .join("");

    if (filteredHeroes.length === 0) {
      gridContainer.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--color-text-tertiary, #636366);">No heroes found</div>';
    }
  };

  renderHeroes();

  // Search input event
  searchInput.addEventListener("input", (e) => {
    renderHeroes((e.target as HTMLInputElement).value);
  });

  // Close button event
  setTimeout(() => {
    const closeBtn = document.getElementById("hero-picker-close");
    if (closeBtn) {
      closeBtn.onclick = closeHeroPicker;
    }
  }, 0);

  // Click outside to close
  heroPickerOverlay.addEventListener("click", (e) => {
    if (e.target === heroPickerOverlay) {
      closeHeroPicker();
    }
  });

  // ESC to close
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeHeroPicker();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  // Assemble modal
  modal.appendChild(header);
  modal.appendChild(searchInput);
  modal.appendChild(gridContainer);
  heroPickerOverlay.appendChild(modal);
  document.body.appendChild(heroPickerOverlay);

  // Focus search input
  searchInput.focus();
}

function closeHeroPicker(): void {
  if (heroPickerOverlay) {
    heroPickerOverlay.remove();
    heroPickerOverlay = null;
  }
  heroPickerSide = null;
  heroPickerSlot = null;
}

async function selectHero(heroName: string): Promise<void> {
  if (!heroPickerSide || !heroPickerSlot) return;

  const success = await postAPI("/api/player/update", {
    side: heroPickerSide,
    slot: heroPickerSlot,
    hero: heroName,
  });

  if (success) {
    console.log(
      `✅ Hero ${heroName} selected for Team ${heroPickerSide} Player ${heroPickerSlot}`
    );
  } else {
    console.error("❌ Failed to update hero");
  }

  closeHeroPicker();
}

// Expose selectHero to window for onclick
(window as any).selectHero = selectHero;

// ==========================================
// Lane Picker Modal
// ==========================================

// ROV Lanes (5 positions)
// ROV Lanes (5 positions)
const LANES = [
  { name: "ds_lane", label: "DS Lane", thaiName: "ออฟเลน", icon: "⚔️" },
  { name: "jungle", label: "Jungle", thaiName: "ป่า", icon: "🌲" },
  { name: "mid", label: "Mid", thaiName: "เมจ", icon: "⭐" },
  { name: "adc", label: "ADC", thaiName: "แครี่", icon: "🎯" },
  { name: "support", label: "Support", thaiName: "โรมมิ่ง", icon: "🛡️" },
];

let lanePickerOverlay: HTMLDivElement | null = null;
let lanePickerSide: "A" | "B" | null = null;
let lanePickerSlot: number | null = null;

function openLanePicker(side: "A" | "B", slot: number): void {
  lanePickerSide = side;
  lanePickerSlot = slot;

  // Create overlay
  lanePickerOverlay = document.createElement("div");
  lanePickerOverlay.id = "lane-picker-overlay";
  lanePickerOverlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;

  // Create modal container
  const modal = document.createElement("div");
  modal.style.cssText = `
        background: var(--color-bg-elevated, #1c1c1e);
        border-radius: 20px;
        width: 100%;
        max-width: 400px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
    `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
  header.innerHTML = `
        <h2 style="color: var(--color-text-primary, #f5f5f7); font-size: 1.125rem; font-weight: 600; margin: 0;">
            <i class="ph-duotone ph-map-pin" style="color: var(--color-warning, #ff9f0a); margin-right: 8px;"></i>
            Select Lane - Player ${slot}
        </h2>
        <button id="lane-picker-close" style="
            width: 32px; height: 32px; border-radius: 50%;
            background: rgba(255, 255, 255, 0.1); border: none;
            color: var(--color-text-secondary, #a1a1a6); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.25rem;
        ">
            <i class="ph-bold ph-x"></i>
        </button>
    `;

  // Lane grid container
  const gridContainer = document.createElement("div");
  gridContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px 24px 24px;
    `;

  // Render lanes
  gridContainer.innerHTML = LANES.map(
    (lane) => `
        <button 
            onclick="selectLane('${lane.name}')"
            style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--color-bg-tertiary, #2c2c2e);
                border: 1px solid transparent;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.15s ease;
                text-align: left;
            "
            onmouseover="this.style.borderColor='var(--color-accent, #0a84ff)'; this.style.background='var(--color-team-a-bg, rgba(10,132,255,0.15))';"
            onmouseout="this.style.borderColor='transparent'; this.style.background='var(--color-bg-tertiary, #2c2c2e)';"
        >
            <img src="/lane/${encodeURIComponent(lane.name)}.jpg" 
                 style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover; background: #1a1a1a;" 
                 alt="${lane.name}"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2212%22%3E${lane.icon}%3C/text%3E%3C/svg%3E';">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--color-text-primary, #f5f5f7); font-size: 0.95rem;">${lane.label}</div>
                <div style="font-size: 0.8rem; color: var(--color-text-tertiary, #636366);">${lane.thaiName}</div>
            </div>
        </button>
    `
  ).join("");

  // Close button event
  setTimeout(() => {
    const closeBtn = document.getElementById("lane-picker-close");
    if (closeBtn) {
      closeBtn.onclick = closeLanePicker;
    }
  }, 0);

  // Click outside to close
  lanePickerOverlay.addEventListener("click", (e) => {
    if (e.target === lanePickerOverlay) {
      closeLanePicker();
    }
  });

  // ESC to close
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeLanePicker();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  // Assemble modal
  modal.appendChild(header);
  modal.appendChild(gridContainer);
  lanePickerOverlay.appendChild(modal);
  document.body.appendChild(lanePickerOverlay);
}

function closeLanePicker(): void {
  if (lanePickerOverlay) {
    lanePickerOverlay.remove();
    lanePickerOverlay = null;
  }
  lanePickerSide = null;
  lanePickerSlot = null;
}

async function selectLane(laneName: string): Promise<void> {
  if (!lanePickerSide || !lanePickerSlot) return;

  const success = await postAPI("/api/player/update", {
    side: lanePickerSide,
    slot: lanePickerSlot,
    lane: laneName,
  });

  if (success) {
    console.log(
      `✅ Lane ${laneName || "cleared"} for Team ${lanePickerSide} Player ${lanePickerSlot}`
    );
  } else {
    console.error("❌ Failed to update lane");
  }

  closeLanePicker();
}

// Expose Lane functions to window
(window as any).openLanePicker = openLanePicker;
(window as any).closeLanePicker = closeLanePicker;
(window as any).selectLane = selectLane;

// Handle lane click with validation
function handleLaneClick(
  side: "A" | "B",
  slot: number,
  hasHero: boolean
): void {
  if (hasHero) {
    openLanePicker(side, slot);
  } else {
    // Show notification that hero must be selected first
    if ((window as any).showNotification) {
      (window as any).showNotification(
        "กรุณาเลือกตัวละครก่อน",
        "เลือก Hero ก่อนถึงจะเลือกตำแหน่งเลนได้",
        "warning"
      );
    }
  }
}
(window as any).handleLaneClick = handleLaneClick;

// ==========================================
// Template Management
// ==========================================

interface TeamTemplate {
  id: string;
  name: string;
  color: string;
  logo: string;
  players: { slot: number; name: string }[];
  createdAt: string;
}

let templates: TeamTemplate[] = [];
let loadedTemplateId: { A: string | null; B: string | null } = {
  A: null,
  B: null,
};

async function fetchTemplates(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/templates`);
    if (response.ok) {
      templates = await response.json();
      renderTemplateDropdowns();
    }
  } catch (err) {
    console.error("❌ Failed to fetch templates:", err);
  }
}

function renderTemplateDropdowns(): void {
  const teamASelect = document.getElementById(
    "teamA-template"
  ) as HTMLSelectElement;
  const teamBSelect = document.getElementById(
    "teamB-template"
  ) as HTMLSelectElement;

  const optionsHtml = templates
    .map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
    .join("");

  const defaultOption = '<option value="">Select Template...</option>';

  if (teamASelect) teamASelect.innerHTML = defaultOption + optionsHtml;
  if (teamBSelect) teamBSelect.innerHTML = defaultOption + optionsHtml;
}

async function loadTemplate(side: "A" | "B"): Promise<void> {
  const selectId = `team${side}-template`;
  const select = document.getElementById(selectId) as HTMLSelectElement;
  const templateId = select?.value;

  if (!templateId) {
    alert("กรุณาเลือก Template ก่อน");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/templates/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, side }),
    });

    if (response.ok) {
      loadedTemplateId[side] = templateId; // Track which template is loaded
      console.log(`✅ Template loaded to Team ${side} (ID: ${templateId})`);
    } else {
      alert("Failed to load template");
    }
  } catch (err) {
    console.error("❌ Load template error:", err);
  }
}

async function saveAsTemplate(side: "A" | "B"): Promise<void> {
  if (!currentState) return;

  const team = currentState.teams[side];
  const templateName = prompt("Enter template name:", team.name);

  if (!templateName) return;

  const templateData = {
    name: templateName,
    color: team.color,
    logo: team.logo,
    players: team.players.map((p) => ({ slot: p.slot, name: p.name })),
  };

  try {
    const response = await fetch(`${API_BASE}/api/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(templateData),
    });

    if (response.ok) {
      console.log(`✅ Template "${templateName}" saved`);
      alert(`Template "${templateName}" saved!`);
      fetchTemplates(); // Refresh dropdown
    } else {
      alert("Failed to save template");
    }
  } catch (err) {
    console.error("❌ Save template error:", err);
  }
}

async function syncTemplateAfterUpdate(side: "A" | "B"): Promise<void> {
  const templateId = loadedTemplateId[side];
  if (!templateId || !currentState) {
    return; // No template loaded for this side
  }

  const team = currentState.teams[side];

  try {
    const response = await fetch(`${API_BASE}/api/templates/${templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: team.name,
        color: team.color,
        logo: team.logo,
        players: team.players.map((p) => ({ slot: p.slot, name: p.name })),
      }),
    });

    if (response.ok) {
      console.log(`🔄 Template ${templateId} synced with Team ${side} changes`);
      await fetchTemplates(); // Refresh templates cache
    }
  } catch (err) {
    console.error("❌ Template sync error:", err);
  }
}
// ==========================================
// Template Manager Modal
// ==========================================

let templateManagerOverlay: HTMLDivElement | null = null;
let templateLogoFile: File | null = null;
let editingTemplateId: string | null = null;

function openTemplateManager(): void {
  templateManagerOverlay = document.createElement("div");
  templateManagerOverlay.id = "template-manager-overlay";
  templateManagerOverlay.classList.add("modal-overlay");

  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.style.cssText = `
        max-width: 800px;
        width: 95%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    `;

  // Header
  const header = document.createElement("div");
  header.classList.add("modal-header");
  header.innerHTML = `
        <h3>Template Manager</h3>
        <button id="close-template-manager" class="close-btn">
            <i class="ph-bold ph-x"></i>
        </button>
    `;

  // Content container
  const content = document.createElement("div");
  content.style.cssText = `
        display: flex;
        gap: 20px;
        flex: 1;
        overflow: hidden;
    `;
  content.classList.add("modal-body");

  // Left: Create New Template Form
  const createSection = document.createElement("div");
  createSection.classList.add("list-selection");
  createSection.style.cssText = `
        flex: 1;
        padding: 16px;
        overflow-y: auto;
    `;
  createSection.innerHTML = `
        <div class="flex items-center gap-2">
<i class="ph ph-grid-four" style="font-size: 22px; color: var(--color-primary);"></i>
        <h3>Create New Template</h3>
  
        </div>
        <div style="margin-bottom: 12px;">
            <label style="font-size: 12px; display: block; margin-bottom: 4px;">TEAM NAME *</label>
            <input type="text" id="tpl-name" placeholder="e.g. T1, LOUD, Gen.G">
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 12px;">
            <div style="flex: 1;">
                <label style="color: #9ca3af; font-size: 12px; display: block; margin-bottom: 4px;">COLOR</label>
                <input type="color" id="tpl-color" value="#3b82f6" style="width: 100%; height: 40px; border: none; border-radius: 8px; cursor: pointer;">
            </div>
            <div style="flex: 2;">
                <label style="color: #9ca3af; font-size: 12px; display: block; margin-bottom: 4px;">COLOR CODE</label>
                <input type="text" id="tpl-color-text" value="#3b82f6">
            </div>
        </div>
        <div style="margin-bottom: 12px;">
            <label style="color: #9ca3af; font-size: 12px; display: block; margin-bottom: 4px;">LOGO</label>
            <div style="display: flex; align-items: center; gap: 10px;">
                <div id="tpl-logo-preview" style="width: 48px; height: 48px; background: var(--color-bg-secondary); border-radius: 8px; border: 1px dashed #374151; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <span style="color: #6b7280; font-size: 10px;">No Logo</span>
                </div>
                <div style="flex: 1;">
                    <input type="file" id="tpl-logo-input" accept="image/*" style="display: none;" onchange="handleTemplateLogoSelect(this)">
                    <button type="button" onclick="document.getElementById('tpl-logo-input').click()" class="choose-btn">
                        <i class="ph ph-selection-all"></i> Choose Logo
                    </button>
                </div>
            </div>
        </div>
        <div style="margin-bottom: 12px;">
            <label style="color: #9ca3af; font-size: 12px; display: block; margin-bottom: 4px;">PLAYERS</label>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <input type="text" id="tpl-p1" placeholder="Player 1" style="width: 100%; padding: 8px; ; border-radius: 6px; font-size: 13px;">
                <input type="text" id="tpl-p3" placeholder="Player 3" style="width: 100%; padding: 8px; ; border-radius: 6px; font-size: 13px;">
                <input type="text" id="tpl-p4" placeholder="Player 4" style="width: 100%; padding: 8px; ; border-radius: 6px; font-size: 13px;">
                <input type="text" id="tpl-p5" placeholder="Player 5" style="width: 100%; padding: 8px; ; border-radius: 6px; font-size: 13px;">
                <input type="text" id="tpl-p2" placeholder="Player 2" style="width: 100%; padding: 8px; ; border-radius: 6px; font-size: 13px;">
            </div>
        </div>
        <button id="create-template-btn">
            Create Template
        </button>
    `;

  // Right: Template List
  const listSection = document.createElement("div");
  listSection.classList.add("list-selection");
  listSection.innerHTML = `
        <div class="flex items-center gap-2">
        <i class="ph ph-airplay" style="font-size: 24px; color: var(--color-primary);"></i>
        <h3> Saved Templates (${templates.length})</h3>
        </div>

        <div id="template-list" style="display: flex; flex-direction: column; gap: 8px;">
            ${
              templates.length === 0
                ? '<p style="color: #6b7280; text-align: center; padding: 20px;">No templates yet</p>'
                : templates
                    .map(
                      (t) => `
                <div class="team-select">
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer;" onclick="loadTemplateToForm('${
                      t.id
                    }')">
                        <div style="width: 16px; height: 16px; border-radius: 4px; background: ${
                          t.color
                        };"></div>
                        <div>
                            <div>${escapeHtml(t.name)}</div>
                            <div style="color: #6b7280; font-size: 11px;">${
                              t.players?.length || 0
                            } players</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="event.stopPropagation(); loadTemplateToForm('${
                          t.id
                        }')"</button>
                        <button class="del-btn" onclick="event.stopPropagation(); deleteTemplate('${
                          t.id
                        }')"><i class="ph ph-backspace"></i></button>
                    </div>
                </div>
            `
                    )
                    .join("")
            }
        </div>
    `;

  // Append all
  content.appendChild(createSection);
  content.appendChild(listSection);
  modal.appendChild(header);
  modal.appendChild(content);
  templateManagerOverlay.appendChild(modal);
  document.body.appendChild(templateManagerOverlay);

  // Event listeners
  document.getElementById("close-template-manager")!.onclick =
    closeTemplateManager;
  templateManagerOverlay.onclick = (e) => {
    if (e.target === templateManagerOverlay) closeTemplateManager();
  };

  // Color sync
  const colorInput = document.getElementById("tpl-color") as HTMLInputElement;
  const colorText = document.getElementById(
    "tpl-color-text"
  ) as HTMLInputElement;
  colorInput.oninput = () => {
    colorText.value = colorInput.value;
  };
  colorText.oninput = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(colorText.value)) {
      colorInput.value = colorText.value;
    }
  };

  // Create button
  document.getElementById("create-template-btn")!.onclick =
    createTemplateFromForm;
}

function closeTemplateManager(): void {
  if (templateManagerOverlay) {
    templateManagerOverlay.remove();
    templateManagerOverlay = null;
  }
}

async function createTemplateFromForm(): Promise<void> {
  const name = (
    document.getElementById("tpl-name") as HTMLInputElement
  ).value.trim();
  const color = (document.getElementById("tpl-color") as HTMLInputElement)
    .value;
  const players = [1, 2, 3, 4, 5]
    .map((i) => ({
      slot: i,
      name: (
        document.getElementById(`tpl-p${i}`) as HTMLInputElement
      ).value.trim(),
    }))
    .filter((p) => p.name);

  if (!name) {
    alert("กรุณาใส่ชื่อ Template");
    return;
  }

  try {
    let response;

    if (editingTemplateId) {
      // Update existing template
      response = await fetch(`${API_BASE}/api/templates/${editingTemplateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, logo: "", players }),
      });
    } else {
      // Create new template
      response = await fetch(`${API_BASE}/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, logo: "", players }),
      });
    }

    if (response.ok) {
      const message = editingTemplateId ? "updated" : "created";
      alert(`✅ Template "${name}" ${message}!`);
      editingTemplateId = null; // Reset editing state
      await fetchTemplates();
      closeTemplateManager();
      openTemplateManager(); // Refresh list
    } else {
      alert("Failed to save template");
    }
  } catch (err) {
    console.error("Save template error:", err);
  }
}

function deleteTemplate(id: string): void {
  console.log("Delete clicked for:", id);

  const template = templates.find((t) => t.id === id);
  const templateName = template?.name || "this template";

  // Create custom confirmation modal
  const confirmOverlay = document.createElement("div");
  confirmOverlay.id = "delete-confirm-overlay";
  confirmOverlay.classList.add("modal-overlay");

  confirmOverlay.innerHTML = `
        <div class="confirm-delete">
            <h3 style="color: #ef4444; font-size: 18px; margin-bottom: 16px;"> ยืนยันการลบ</h3>
            <p style="color: white; margin-bottom: 8px;">คุณต้องการลบ Template</p>
            <p style="color: #a855f7; font-weight: bold; font-size: 16px; margin-bottom: 16px;">"${templateName}"</p>
            <p style="color: #6b7280; font-size: 12px; margin-bottom: 24px;">การลบจะไม่สามารถกู้คืนได้</p>
            <div style="display: flex; gap: 12px; justify-content: end;">
                <button id="confirm-delete-yes" style="padding: 10px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">🗑️ ลบเลย</button>
                <button id="confirm-delete-no" style="padding: 10px 24px; background: #374151; color: white; border: none; border-radius: 8px; cursor: pointer;">ยกเลิก</button>
            </div>
        </div>
    `;

  document.body.appendChild(confirmOverlay);

  // Handle confirmation
  document.getElementById("confirm-delete-yes")!.onclick = async () => {
    confirmOverlay.remove();

    try {
      console.log(`Deleting template: ${id}`);
      const response = await fetch(`${API_BASE}/api/templates/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        await fetchTemplates();
        closeTemplateManager();
        openTemplateManager();
      } else {
        alert("❌ ไม่สามารถลบได้");
      }
    } catch (err) {
      console.error("Delete template error:", err);
    }
  };

  document.getElementById("confirm-delete-no")!.onclick = () => {
    confirmOverlay.remove();
  };

  confirmOverlay.onclick = (e) => {
    if (e.target === confirmOverlay) {
      confirmOverlay.remove();
    }
  };
}

function loadTemplateToForm(id: string): void {
  const template = templates.find((t) => t.id === id);
  if (!template) return;

  editingTemplateId = id;

  // Populate form fields
  const nameInput = document.getElementById("tpl-name") as HTMLInputElement;
  const colorInput = document.getElementById("tpl-color") as HTMLInputElement;
  const colorText = document.getElementById(
    "tpl-color-text"
  ) as HTMLInputElement;

  if (nameInput) nameInput.value = template.name;
  if (colorInput) colorInput.value = template.color;
  if (colorText) colorText.value = template.color;

  // Populate players
  for (let i = 1; i <= 5; i++) {
    const playerInput = document.getElementById(
      `tpl-p${i}`
    ) as HTMLInputElement;
    const player = template.players?.find((p) => p.slot === i);
    if (playerInput) {
      playerInput.value = player?.name || "";
    }
  }

  // Update button text to show "Update" instead of "Create"
  const createBtn = document.getElementById("create-template-btn");
  if (createBtn) {
    createBtn.innerHTML = "Update Template";
  }

  // Scroll to form (visual feedback)
  const tplName = document.getElementById("tpl-name");
  tplName?.focus();
}

function handleTemplateLogoSelect(input: HTMLInputElement): void {
  const file = input.files?.[0];
  if (!file) return;

  templateLogoFile = file;

  const preview = document.getElementById("tpl-logo-preview");
  if (preview) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target?.result}" style="width: 100%; height: 100%; object-fit: contain;">`;
    };
    reader.readAsDataURL(file);
  }
}

// Expose template functions to window
(window as any).loadTemplate = loadTemplate;
(window as any).saveAsTemplate = saveAsTemplate;
(window as any).openTemplateManager = openTemplateManager;
(window as any).deleteTemplate = deleteTemplate;
(window as any).handleTemplateLogoSelect = handleTemplateLogoSelect;
(window as any).loadTemplateToForm = loadTemplateToForm;

// ==========================================
// Drag & Drop Player Reordering
// ==========================================

// Track mouse down target for accurate drag source detection
let dragSourceElement: HTMLElement | null = null;
document.addEventListener("mousedown", (e) => {
  dragSourceElement = e.target as HTMLElement;
});

let draggedPlayer: {
  side: string;
  slot: number;
  mode: "full" | "hero";
} | null = null;

function handleDragStart(event: DragEvent): void {
  const card = (event.target as HTMLElement).closest(
    ".player-card"
  ) as HTMLElement;
  if (!card) return;

  // Check if the initial click was within the hero section
  const heroSection = dragSourceElement?.closest(".player-card__hero");

  // Debug
  console.log("Drag Start Source:", {
    source: dragSourceElement?.className,
    isHero: !!heroSection,
  });

  draggedPlayer = {
    side: card.dataset.side || "A",
    slot: parseInt(card.dataset.slot || "1"),
    mode: heroSection ? "hero" : "full",
  };

  card.classList.add("dragging");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    // Optional: Set custom drag image if needed
  }
}

function handleDragEnd(event: DragEvent): void {
  const card = (event.target as HTMLElement).closest(
    ".player-card"
  ) as HTMLElement;
  if (card) {
    card.classList.remove("dragging");
  }
  document
    .querySelectorAll(".player-card")
    .forEach((c) => c.classList.remove("drag-over"));
  draggedPlayer = null;
}

function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  const card = (event.target as HTMLElement).closest(
    ".player-card"
  ) as HTMLElement;
  if (!card || !draggedPlayer) return;

  const targetSide = card.dataset.side;
  if (targetSide !== draggedPlayer.side) return; // Only allow same-team drag

  card.classList.add("drag-over");
}

async function handleDrop(event: DragEvent): Promise<void> {
  event.preventDefault();
  const targetCard = (event.target as HTMLElement).closest(
    ".player-card"
  ) as HTMLElement;
  if (!targetCard || !draggedPlayer) return;

  const targetSide = targetCard.dataset.side;
  const targetSlot = parseInt(targetCard.dataset.slot || "1");

  if (targetSide !== draggedPlayer.side) return;
  if (targetSlot === draggedPlayer.slot) return;

  // Swap players via API
  const side = draggedPlayer.side as "A" | "B";
  await swapPlayers(side, draggedPlayer.slot, targetSlot, draggedPlayer.mode);

  targetCard.classList.remove("drag-over");
  draggedPlayer = null;
}

async function swapPlayers(
  side: "A" | "B",
  slot1: number,
  slot2: number,
  mode: "full" | "hero" = "full"
): Promise<void> {
  if (!currentState) return;

  const team = currentState.teams[side];
  const player1 = team.players.find((p) => p.slot === slot1);
  const player2 = team.players.find((p) => p.slot === slot2);

  if (!player1 || !player2) return;

  if (mode === "hero") {
    // Swap ONLY Heroes
    await postAPI("/api/player/update", {
      side,
      slot: slot1,
      hero: player2.hero || "",
    });
    await postAPI("/api/player/update", {
      side,
      slot: slot2,
      hero: player1.hero || "",
    });

    if ((window as any).showNotification) {
      (window as any).showNotification(
        "Heroes Swapped",
        `Slot ${slot1} ↔ Slot ${slot2}`,
        "success"
      );
    }
  } else {
    // Full Swap (Reorder)
    const data1 = {
      name: player1.name,
      hero: player1.hero || "",
      lane: player1.lane || "",
      isCaptain: player1.isCaptain || false,
    };
    const data2 = {
      name: player2.name,
      hero: player2.hero || "",
      lane: player2.lane || "",
      isCaptain: player2.isCaptain || false,
    };

    await postAPI("/api/player/update", {
      side,
      slot: slot1,
      name: data2.name,
      hero: data2.hero,
      lane: data2.lane,
      isCaptain: data2.isCaptain,
    });

    await postAPI("/api/player/update", {
      side,
      slot: slot2,
      name: data1.name,
      hero: data1.hero,
      lane: data1.lane,
      isCaptain: data1.isCaptain,
    });

    if ((window as any).showNotification) {
      (window as any).showNotification(
        "Players Reordered",
        `Slot ${slot1} ↔ Slot ${slot2}`,
        "success"
      );
    }
  }
}

// ==========================================
// Captain Toggle
// ==========================================

async function toggleCaptain(side: "A" | "B", slot: number): Promise<void> {
  if (!currentState) return;

  const team = currentState.teams[side];

  // Clear captain from all other players in this team
  for (const player of team.players) {
    if (player.slot !== slot && player.isCaptain) {
      await postAPI("/api/player/update", {
        side,
        slot: player.slot,
        isCaptain: false,
      });
    }
  }

  // Toggle captain for selected player
  const currentPlayer = team.players.find((p) => p.slot === slot);
  const newCaptainStatus = !currentPlayer?.isCaptain;
  await postAPI("/api/player/update", {
    side,
    slot,
    isCaptain: newCaptainStatus,
  });

  if ((window as any).showNotification) {
    if (newCaptainStatus) {
      (window as any).showNotification(
        "Captain set",
        `Player ${slot} is now captain`,
        "success"
      );
    } else {
      (window as any).showNotification("Captain removed", "", "info");
    }
  }
}

// ==========================================
// Theme Toggle
// ==========================================

function toggleTheme(): void {
  const html = document.documentElement;
  const currentTheme = html.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", newTheme);

  // Update icon
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.className = newTheme === "dark" ? "ph-bold ph-moon" : "ph-bold ph-sun";
  }

  // Save preference
  localStorage.setItem("esport-theme", newTheme);
}

// Expose drag & drop and captain functions
(window as any).handleDragStart = handleDragStart;
(window as any).handleDragEnd = handleDragEnd;
(window as any).handleDragOver = handleDragOver;
(window as any).handleDrop = handleDrop;
(window as any).toggleCaptain = toggleCaptain;

// Expose UI Navigation
(window as any).toggleSettingsMenu = toggleSettingsMenu;
(window as any).switchPage = switchPage;
(window as any).toggleTheme = toggleTheme;
(window as any).saveTeam = saveTeam;
(window as any).adjustScore = adjustScore;
(window as any).swapSides = swapSides;
(window as any).handleLogoSelect = handleLogoSelect;
(window as any).pickScreenColor = pickScreenColor;
(window as any).pickLogoColor = pickLogoColor;

// ==========================================
// Initialization
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Esport Control Panel Initializing...");

  // Fetch initial state via REST API
  fetchInitialState();

  // Fetch templates
  fetchTemplates();

  // Connect to WebSocket for real-time updates
  // Connect to WebSocket for real-time updates
  connectWebSocket();

  // Bind UI Events explicitly (Fixes Module Scope issues)
  document
    .getElementById("hamburger-btn")
    ?.addEventListener("click", toggleSettingsMenu);
  document
    .getElementById("nav-scoreboard")
    ?.addEventListener("click", () => switchPage("scoreboard"));
  document
    .getElementById("nav-broadcast")
    ?.addEventListener("click", () => switchPage("broadcast"));

  // Theme toggle button
  document
    .getElementById("theme-toggle-btn")
    ?.addEventListener("click", toggleTheme);

  // Helper to bind close on menu outside click
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("settings-menu");
    const btn = document.getElementById("hamburger-btn");
    if (
      menu &&
      menu.classList.contains("active") &&
      !menu.contains(e.target as Node) &&
      !btn?.contains(e.target as Node)
    ) {
      menu.classList.remove("active");
    }
  });
});
