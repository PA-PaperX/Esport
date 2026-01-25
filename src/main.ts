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
  bans?: string[]; // Banned hero names
}

interface MatchState {
  matchId: string;
  bestOf: number;
  currentGame: number;
  swapped?: boolean;
  banCount?: number; // 1-6, number of ban slots per team
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
const WS_URL = `ws://localhost:3000/ws`;
const API_BASE = `http://localhost:3000`;

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
      const message = JSON.parse(event.data);

      if (message.type === "STATE_UPDATE" && message.data) {
        currentState = message.data;
        renderUI();
      }

      // Real-time template sync
      if (message.type === "TEMPLATES_UPDATE") {
        console.log("📁 Templates updated via WebSocket");
        fetchTemplates(); // Re-fetch and render templates
      }

      // BRACKET_UPDATE - will be implemented when bracket functions are available
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

  // Option B: Control Panel swaps data to match overlay display
  // When swapped: Left panel shows Team B data, Right panel shows Team A data
  // This helps users see what will appear on each side of the broadcast
  if (swapped) {
    renderTeamData("A", currentState.teams.B); // Left panel shows Team B
    renderTeamData("B", currentState.teams.A); // Right panel shows Team A
  } else {
    renderTeamData("A", currentState.teams.A); // Normal: Left = Team A
    renderTeamData("B", currentState.teams.B); // Normal: Right = Team B
  }

  // Render bans (also needs to respect swap)
  renderBanSlots();

  // Update swap status indicator
  const swapStatus = document.getElementById("swap-status");
  if (swapStatus) {
    swapStatus.textContent = swapped ? "🔀 สลับฝั่ง" : "ปกติ";
  }

  // Update panel titles based on swap state
  const teamATitle = document.querySelector(
    "#teamA-section .team-panel__title",
  );
  const teamBTitle = document.querySelector(
    "#teamB-section .team-panel__title",
  );

  if (teamATitle) {
    teamATitle.textContent = swapped ? "Team B" : "Team A";
  }
  if (teamBTitle) {
    teamBTitle.textContent = swapped ? "Team A" : "Team B";
  }

  // Update button labels based on swap state
  const teamABtn = document.querySelector(
    '#teamA-section button[onclick*="saveTeam"]',
  ) as HTMLButtonElement;
  const teamBBtn = document.querySelector(
    '#teamB-section button[onclick*="saveTeam"]',
  ) as HTMLButtonElement;

  if (teamABtn) {
    teamABtn.textContent = swapped ? "Update Team B" : "Update Team A";
    // Update button color to match displayed team
    const btnColor = swapped
      ? currentState.teams.B.color
      : currentState.teams.A.color;
    teamABtn.style.backgroundColor = btnColor;
    const rgb = hexToRgb(btnColor);
    if (rgb) {
      teamABtn.style.boxShadow = `0 4px 6px -1px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
    }
  }

  if (teamBBtn) {
    teamBBtn.textContent = swapped ? "Update Team A" : "Update Team B";
    const btnColor = swapped
      ? currentState.teams.A.color
      : currentState.teams.B.color;
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

  // Render players - Control Panel always shows actual team data
  // Left panel = Team A, Right panel = Team B (no swap adjustment)
  if (playersContainer) {
    renderPlayers(side, side, team.players, playersContainer);
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
      ".player-card",
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
  panelSide: "A" | "B",
  teamSide: "A" | "B",
  players: Player[],
  container: HTMLDivElement,
): void {
  // panelSide = for styling (player-card--a or --b)
  // teamSide = for API calls (updatePlayer, openHeroPicker, etc.)
  const sideClass = panelSide === "A" ? "player-card--a" : "player-card--b";

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
         data-side="${teamSide}" 
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
           onclick="handleLaneClick('${teamSide}', ${player.slot}, ${
             player.hero ? "true" : "false"
           })"
           title="${
             player.lane || (player.hero ? "Select Lane" : "Select Hero first")
           }">
        ${
          laneImgPath
            ? `<img src="${laneImgPath}" alt="${escapeHtml(
                player.lane || "",
              )}">`
            : '<i class="ph-duotone ph-map-pin"></i>'
        }
      </div>
      
      <!-- Name Input -->
      <div class="player-card__name">
        <input 
          type="text" 
          value="${escapeHtml(player.name)}" 
          onchange="updatePlayer('${teamSide}', ${player.slot}, this.value)"
          placeholder="Player ${player.slot}"
        />
      </div>
      
      <!-- Hero Avatar -->
      <div class="player-card__hero ${player.hero ? "has-hero" : ""}" 
           onclick="openHeroPicker('${teamSide}', ${player.slot})"
           title="${player.hero || "Select Hero"}">
        ${
          heroImgPath
            ? `<img src="${heroImgPath}" alt="${escapeHtml(
                player.hero || "",
              )}">`
            : '<i class="ph-duotone ph-game-controller"></i>'
        }
      </div>
      
      <!-- Captain Toggle -->
      <button class="player-card__captain ${player.isCaptain ? "active" : ""}" 
              onclick="toggleCaptain('${teamSide}', ${player.slot})"
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

  // Option B: When swapped, panel A shows Team B data, panel B shows Team A data
  // So we need to send the update to the ACTUAL team the panel is displaying
  const swapped = currentState?.swapped || false;
  const actualSide = swapped ? (side === "A" ? "B" : "A") : side;

  const success = await postAPI("/api/team/update", {
    side: actualSide,
    name: nameInput.value,
    color: colorInput.value,
  });

  if (success) {
    console.log(`✅ Team ${actualSide} saved (from panel ${side})`);
    // Sync changes back to loaded template if exists
    await syncTemplateAfterUpdate(actualSide);
  } else {
    console.error(`❌ Failed to save Team ${actualSide}`);
  }
}

async function adjustScore(side: "A" | "B", delta: number): Promise<void> {
  if (!currentState) return;

  // When swapped, panel A shows Team B data, panel B shows Team A data
  // So we need to adjust the ACTUAL team the panel is displaying
  const swapped = currentState.swapped || false;
  const actualSide = swapped ? (side === "A" ? "B" : "A") : side;

  const team = currentState.teams[actualSide];
  const newScore = Math.max(0, team.score + delta);

  const success = await postAPI("/api/team/update", {
    side: actualSide,
    score: newScore,
  });

  if (success) {
    console.log(
      `✅ Score ${actualSide} updated: ${newScore} (from panel ${side})`,
    );
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
        `✅ Sides swapped: ${
          result.swapped ? "Team A → Right, Team B → Left" : "Normal"
        }`,
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
    "transition-logo-img",
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
  input: HTMLInputElement,
): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;

  const img = document.getElementById(
    "transition-logo-img",
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
          "transition-logo-img",
        ) as HTMLImageElement;
        const placeholder = document.getElementById(
          "transition-logo-placeholder",
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

// Update Lower Third settings (simplified)
async function updateLowerThird(): Promise<void> {
  const title =
    (document.getElementById("lower-third-title") as HTMLInputElement)?.value ||
    "";

  const slots = [1, 2, 3].map((id) => {
    const textInput = document.getElementById(
      `slot-${id}-text`,
    ) as HTMLInputElement;
    const text = textInput?.value || "";

    return {
      id,
      enabled: text.trim() !== "", // Enable if has text
      type: "logo", // Always logo type now
      logoPath: "", // Will be set by logo upload
      text: text,
      label: text,
    };
  });

  try {
    const response = await fetch(`${API_BASE}/api/lower-third`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, title, slots }),
    });

    if (response.ok) {
      console.log("✅ Lower Third updated");
      if ((window as any).showNotification) {
        (window as any).showNotification(
          "Lower Third Saved",
          "Settings updated successfully",
          "success",
        );
      }
    } else {
      console.error("❌ Failed to update Lower Third");
    }
  } catch (err) {
    console.error("❌ Lower Third update error:", err);
  }
}

// Alias for saveLowerThird
const saveLowerThird = updateLowerThird;

// Clear a specific slot
function clearSlot(slotId: number): void {
  const textInput = document.getElementById(
    `slot-${slotId}-text`,
  ) as HTMLInputElement;
  const logoPreview = document.getElementById(`slot-${slotId}-logo-preview`);

  if (textInput) textInput.value = "";
  if (logoPreview) {
    logoPreview.style.backgroundImage = "";
    logoPreview.innerHTML =
      '<i class="ph-duotone ph-image" style="font-size: 16px; color: var(--color-text-tertiary);"></i>';
  }

  console.log(`🗑️ Slot ${slotId} cleared`);
}

// Upload logo for specific slot (with preview)
async function uploadSlotLogo(
  slotId: number,
  input: HTMLInputElement,
): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;

  // Show preview immediately
  const logoPreview = document.getElementById(`slot-${slotId}-logo-preview`);
  if (logoPreview) {
    const reader = new FileReader();
    reader.onload = (e) => {
      logoPreview.style.backgroundImage = `url('${e.target?.result}')`;
      logoPreview.innerHTML = ""; // Remove placeholder icon
    };
    reader.readAsDataURL(file);
  }

  const formData = new FormData();
  formData.append("logo", file);

  try {
    const response = await fetch(
      `${API_BASE}/api/lower-third/slot/${slotId}/logo`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (response.ok) {
      console.log(`✅ Slot ${slotId} logo uploaded`);
      if ((window as any).showNotification) {
        (window as any).showNotification(
          "Logo Uploaded",
          `Slot ${slotId} logo saved`,
          "success",
        );
      }
    } else {
      console.error(`❌ Failed to upload slot ${slotId} logo`);
    }
  } catch (err) {
    console.error("❌ Slot logo upload error:", err);
  }
}

// Load Lower Third state on page load (simplified)
async function loadLowerThird(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/lower-third`);
    if (response.ok) {
      const state = await response.json();

      // Update title
      const titleEl = document.getElementById(
        "lower-third-title",
      ) as HTMLInputElement;
      if (titleEl) titleEl.value = state.title || "";

      // Update slots
      state.slots?.forEach(
        (slot: {
          id: number;
          enabled: boolean;
          type: string;
          text: string;
          logoPath?: string;
        }) => {
          const slotText = document.getElementById(
            `slot-${slot.id}-text`,
          ) as HTMLInputElement;
          const logoPreview = document.getElementById(
            `slot-${slot.id}-logo-preview`,
          );

          if (slotText) slotText.value = slot.text || "";

          // Show logo preview if exists
          if (logoPreview && slot.logoPath) {
            logoPreview.style.backgroundImage = `url('${slot.logoPath}')`;
            logoPreview.innerHTML = "";
          }
        },
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

  // Hide ALL pages by removing 'active' class
  const allPages = [
    "scoreboard",
    "broadcast",
    "showinfo",
    "bracket",
    "fonts",
    "wait",
    "obs",
  ];
  allPages.forEach((p) => {
    const pageEl = document.getElementById(`page-${p}`);
    const navEl = document.getElementById(`nav-${p}`);
    if (pageEl) {
      pageEl.classList.remove("active");
      pageEl.style.display = "none"; // Force hide
    }
    if (navEl) navEl.classList.remove("active");
  });

  // Show selected page
  const targetPage = document.getElementById(`page-${page}`);
  const targetNav = document.getElementById(`nav-${page}`);

  if (targetPage) {
    targetPage.classList.add("active");
    targetPage.style.display = ""; // Clear inline style to let CSS take over
  }
  if (targetNav) targetNav.classList.add("active");

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
        "event-name",
      ) as HTMLInputElement;
      const colorInput = document.getElementById(
        "transition-color",
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
  name: string,
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
  input: HTMLInputElement,
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
  // Control Panel always references actual team identity (no swap adjustment)
  // Left panel = Team A, Right panel = Team B

  // Open Crop Modal instead of direct upload
  openCropModal(file, side);
  input.value = "";
}

// ==========================================
// Match Settings
// ==========================================

async function updateMatchSettings(): Promise<void> {
  const bestOfInput = document.getElementById("best-of") as HTMLInputElement;
  if (!bestOfInput) return;

  const bestOf = parseInt(bestOfInput.value, 10);
  const success = await postAPI("/api/match/update", { bestOf });

  if (success) {
    if (currentState) currentState.bestOf = bestOf;
    console.log(`✅ Best Of updated to ${bestOf}`);
  }
}

async function updateBanCount(): Promise<void> {
  const select = document.getElementById("ban-count") as HTMLSelectElement;
  if (!select) return;

  const count = parseInt(select.value, 10);
  const success = await postAPI("/api/match/update", { banCount: count });

  if (success) {
    if (currentState) currentState.banCount = count;
    renderBanSlots();
    console.log(`✅ Ban Count updated to ${count}`);
  }
}

(window as any).updateMatchSettings = updateMatchSettings;
(window as any).updateBanCount = updateBanCount;

// ==========================================
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
let currentCropSide: "A" | "B" | "TEMPLATE" | null = null;

function openCropModal(file: File, side: "A" | "B" | "TEMPLATE"): void {
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
    cropImage.height * cropScale,
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
    true,
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
    Math.PI * 2,
  );
  cropCtx.stroke();
}

function confirmCrop(): void {
  if (!cropCanvas || !currentCropSide) return;

  cropCanvas.toBlob(async (blob) => {
    if (blob) {
      if (currentCropSide === "TEMPLATE") {
        // Handle Template Manager Crop
        const file = new File([blob], "template_logo.png", {
          type: "image/png",
        });
        templateLogoFile = file; // Store for later upload

        // Update Preview
        const previewEl = document.getElementById("tpl-logo-preview");
        if (previewEl) {
          previewEl.innerHTML = `<img src="${URL.createObjectURL(blob)}" style="width: 100%; height: 100%; object-fit: contain;">`;
        }

        closeCropModal();
      } else {
        // Handle Team A/B Upload
        const file = new File([blob], "logo_cropped.png", {
          type: "image/png",
        });
        await uploadLogo(currentCropSide as "A" | "B", file);
        closeCropModal();
      }
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
      // Control Panel always references actual team identity (no swap adjustment)
      applyColor(side, result.sRGBHex, side);
    } catch (err) {
      console.log("Color picking cancelled");
    }
  } else {
    alert(
      "ฟีเจอร์นี้รองรับเฉพาะ Chrome/Edge บน Desktop\n(กรุณาใช้ Color Picker ปกติ หรือดูดสีจากโลโก้แทน)",
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

  // Control Panel always references actual team identity (no swap adjustment)
  // Left panel = Team A, Right panel = Team B

  // Open pixel picker modal with both actual and panel side
  openPixelPickerModal(side, side, logoImg.src);
}

function openPixelPickerModal(
  actualSide: "A" | "B",
  panelSide: "A" | "B",
  imageSrc: string,
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
  panelSide?: "A" | "B",
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
    `🎨 Picked color for Team ${actualSide} (panel ${uiSide}): ${color}`,
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
  Goverra: { name: "Goverra", ext: "png" },
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

// Updated for assets in public/assets/heroes - checks HERO_FILE_MAP first
function getHeroImagePath(heroName: string): string {
  // Check if this hero has a special filename mapping
  if (HERO_FILE_MAP[heroName]) {
    const mapping = HERO_FILE_MAP[heroName];
    return `/assets/heroes/${mapping.name}.${mapping.ext}`;
  }

  // Default: standardize name and use webp
  let formatted = heroName.trim();
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  formatted = formatted.replace(/\s+/g, "_");

  return `/assets/heroes/${formatted}.webp`;
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
        background: var(--color-bg-elevated);
        border-radius: var(--radius-xl);
        width: 100%;
        max-width: 800px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: var(--shadow-xl);
        border: 1px solid var(--color-border-light);
        overflow: hidden;
    `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
        padding: 20px 24px;
        border-bottom: 1px solid var(--color-border-light);
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
  header.innerHTML = `
        <h2 style="color: var(--color-text-primary); font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); margin: 0;">
            <i class="ph-duotone ph-game-controller" style="color: var(--color-accent); margin-right: 8px;"></i>
            Select Hero - Team ${side} Player ${slot}
        </h2>
        <button id="hero-picker-close" style="
            width: 32px; height: 32px; border-radius: var(--radius-full);
            background: var(--color-bg-tertiary); border: none;
            color: var(--color-text-secondary); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: var(--font-size-xl);
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
        font-size: var(--font-size-base);
        color: var(--color-text-primary);
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
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
                    background: var(--color-bg-tertiary);
                    border: 2px solid transparent;
                    border-radius: var(--radius-lg);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                "
                onmouseover="this.style.borderColor='var(--color-accent)'; this.style.transform='scale(1.05)';"
                onmouseout="this.style.borderColor='transparent'; this.style.transform='scale(1)';"
                title="${hero.replace(/"/g, "&quot;")}"
            >
                <img 
                    src="${getHeroImagePath(hero)}" 
                    alt="${hero.replace(/"/g, "&quot;")}"
                    style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; background: #1a1a1a;"
                    onerror="if (this.src.endsWith('.png')) { this.src = this.src.replace('.png', '.webp'); } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }"
                >
                <div style="display: none; width: 60px; height: 60px; border-radius: 8px; background: var(--color-bg-secondary); align-items: center; justify-content: center;">
                    <i class="ph-duotone ph-game-controller" style="font-size: 1.5rem; color: var(--color-text-tertiary);"></i>
                </div>
                <span style="
                    font-size: var(--font-size-xs);
                    color: var(--color-text-secondary);
                    text-align: center;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    width: 100%;
                ">${hero}</span>
            </button>
        `,
      )
      .join("");

    if (filteredHeroes.length === 0) {
      gridContainer.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--color-text-tertiary);">No heroes found</div>';
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

// ==========================================
// Ban Picker Modal
// ==========================================

let banPickerOverlay: HTMLDivElement | null = null;
let banPickerSide: "A" | "B" | null = null;
let banPickerSlot: number | null = null;

function openBanPicker(side: "A" | "B", slot: number): void {
  banPickerSide = side;
  banPickerSlot = slot;

  banPickerOverlay = document.createElement("div");
  banPickerOverlay.id = "ban-picker-overlay";
  banPickerOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background: var(--color-bg-elevated);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 800px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--color-border-light);
    overflow: hidden;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-border-light);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.1), transparent);
  `;
  header.innerHTML = `
    <h2 style="color: var(--color-text-primary); font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); margin: 0;">
      <i class="ph-duotone ph-prohibit" style="color: var(--color-danger); margin-right: 8px;"></i>
      Ban Hero - Team ${side} Slot ${slot}
    </h2>
    <button id="ban-picker-close" style="
      width: 32px; height: 32px; border-radius: var(--radius-full);
      background: var(--color-bg-tertiary); border: none;
      color: var(--color-text-secondary); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: var(--font-size-xl);
    ">
      <i class="ph-bold ph-x"></i>
    </button>
  `;

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search hero to ban...";
  searchInput.style.cssText = `
    margin: 16px 24px;
    padding: 12px 16px;
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    outline: none;
  `;

  const gridContainer = document.createElement("div");
  gridContainer.id = "ban-hero-grid";
  gridContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 12px;
    padding: 0 24px 24px;
    overflow-y: auto;
    max-height: 50vh;
  `;

  const renderHeroes = (filter: string = "") => {
    const filteredHeroes = filter
      ? HEROES.filter((h) => h.toLowerCase().includes(filter.toLowerCase()))
      : HEROES;

    gridContainer.innerHTML = filteredHeroes
      .map(
        (hero) => `
        <button 
          data-hero-name="${hero.replace(/"/g, "&quot;")}"
          onclick="selectBan(this.dataset.heroName)"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 8px;
            background: var(--color-bg-tertiary);
            border: 2px solid transparent;
            border-radius: var(--radius-lg);
            cursor: pointer;
            transition: all var(--transition-fast);
            position: relative;
          "
          onmouseover="this.style.borderColor='var(--color-danger)'; this.style.transform='scale(1.05)';"
          onmouseout="this.style.borderColor='transparent'; this.style.transform='scale(1)';"
          title="Ban ${hero.replace(/"/g, "&quot;")}"
        >
          <img 
            src="${getHeroImagePath(hero)}" 
            alt="${hero.replace(/"/g, "&quot;")}"
            style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; background: #1a1a1a;"
            onerror="if (this.src.endsWith('.png')) { this.src = this.src.replace('.png', '.webp'); } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }"
          >
          <div style="display: none; width: 60px; height: 60px; border-radius: 8px; background: var(--color-bg-secondary); align-items: center; justify-content: center;">
            <i class="ph-duotone ph-game-controller" style="font-size: 1.5rem; color: var(--color-text-tertiary);"></i>
          </div>
          <span style="
            font-size: var(--font-size-xs);
            color: var(--color-text-secondary);
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
          ">${hero}</span>
        </button>
      `,
      )
      .join("");

    if (filteredHeroes.length === 0) {
      gridContainer.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--color-text-tertiary);">No heroes found</div>';
    }
  };

  renderHeroes();

  searchInput.addEventListener("input", (e) => {
    renderHeroes((e.target as HTMLInputElement).value);
  });

  setTimeout(() => {
    const closeBtn = document.getElementById("ban-picker-close");
    if (closeBtn) closeBtn.onclick = closeBanPicker;
  }, 0);

  banPickerOverlay.addEventListener("click", (e) => {
    if (e.target === banPickerOverlay) closeBanPicker();
  });

  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeBanPicker();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  modal.appendChild(header);
  modal.appendChild(searchInput);
  modal.appendChild(gridContainer);
  banPickerOverlay.appendChild(modal);
  document.body.appendChild(banPickerOverlay);
  searchInput.focus();
}

function closeBanPicker(): void {
  if (banPickerOverlay) {
    banPickerOverlay.remove();
    banPickerOverlay = null;
  }
  banPickerSide = null;
  banPickerSlot = null;
}

async function selectBan(heroName: string): Promise<void> {
  if (!banPickerSide || banPickerSlot === null) return;

  const success = await postAPI("/api/ban/update", {
    side: banPickerSide,
    slot: banPickerSlot,
    hero: heroName,
  });

  if (success) {
    console.log(
      `🚫 Banned ${heroName} for Team ${banPickerSide} Slot ${banPickerSlot}`,
    );
    renderBanSlots(); // Refresh UI
  } else {
    console.error("❌ Failed to update ban");
  }

  closeBanPicker();
}

async function clearBan(side: "A" | "B", slot: number): Promise<void> {
  const success = await postAPI("/api/ban/update", {
    side: side,
    slot: slot,
    hero: "",
  });

  if (success) {
    console.log(`✅ Cleared ban for Team ${side} Slot ${slot}`);
    renderBanSlots();
  }
}

function renderBanSlots(): void {
  const banCount = currentState?.banCount || 3;
  const swapped = currentState?.swapped || false;

  // Option B: When swapped, panel A shows Team B data, panel B shows Team A data
  ["A", "B"].forEach((panelSide) => {
    const container = document.getElementById(`team${panelSide}-bans`);
    if (!container) return;

    // Determine which team's bans to show based on swap state
    const actualTeam = swapped ? (panelSide === "A" ? "B" : "A") : panelSide;
    const bans = currentState?.teams[actualTeam as "A" | "B"]?.bans || [];

    let html = "";
    for (let i = 0; i < banCount; i++) {
      const heroName = bans[i] || "";
      const hasHero = !!heroName;

      // Use actualTeam for API calls (actual team identity)
      if (hasHero) {
        html += `
          <div class="ban-slot filled" onclick="openBanPicker('${actualTeam}', ${i})" title="${heroName}">
            <img src="${getHeroImagePath(heroName)}" alt="${heroName}" 
                 onerror="if (this.src.endsWith('.png')) { this.src = this.src.replace('.png', '.webp'); }">
            <div class="ban-x">✕</div>
            <button class="ban-clear" onclick="event.stopPropagation(); clearBan('${actualTeam}', ${i})" title="Clear">
              <i class="ph-bold ph-x"></i>
            </button>
          </div>
        `;
      } else {
        html += `
          <div class="ban-slot empty" onclick="openBanPicker('${actualTeam}', ${i})" title="Click to ban">
            <i class="ph-duotone ph-prohibit"></i>
          </div>
        `;
      }
    }

    container.innerHTML = html;
  });
}

// Expose ban functions to window
(window as any).openBanPicker = openBanPicker;
(window as any).closeBanPicker = closeBanPicker;
(window as any).selectBan = selectBan;
(window as any).clearBan = clearBan;
(window as any).renderBanSlots = renderBanSlots;

async function selectHero(heroName: string): Promise<void> {
  if (!heroPickerSide || !heroPickerSlot) return;

  // When swapped, panel A shows Team B data, panel B shows Team A data
  const swapped = currentState ? currentState.swapped : false;
  // If we clicked on panel "A" and we are swapped, we actually want to update Team "B"
  // But wait, the panel ID mapping is already tricky.
  // The panels are labeled "Team A" and "Team B" on the UI.
  // Previous fixes suggest we need to FLIP the side if swapped.
  // "heroPickerSide" comes from openHeroPicker(side), where side is "A" or "B" from the button.

  const actualSide = swapped
    ? heroPickerSide === "A"
      ? "B"
      : "A"
    : heroPickerSide;

  const success = await postAPI("/api/player/update", {
    side: actualSide,
    slot: heroPickerSlot,
    hero: heroName,
  });

  if (success) {
    console.log(
      `✅ Hero ${heroName} selected for Team ${actualSide} Player ${heroPickerSlot} (Panel ${heroPickerSide})`,
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
        background: var(--color-bg-elevated);
        border-radius: var(--radius-xl);
        width: 100%;
        max-width: 400px;
        display: flex;
        flex-direction: column;
        box-shadow: var(--shadow-xl);
        border: 1px solid var(--color-border-light);
        overflow: hidden;
    `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
        padding: 20px 24px;
        border-bottom: 1px solid var(--color-border-light);
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
  header.innerHTML = `
        <h2 style="color: var(--color-text-primary); font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); margin: 0;">
            <i class="ph-duotone ph-map-pin" style="color: var(--color-warning); margin-right: 8px;"></i>
            Select Lane - Player ${slot}
        </h2>
        <button id="lane-picker-close" style="
            width: 32px; height: 32px; border-radius: var(--radius-full);
            background: var(--color-bg-tertiary); border: none;
            color: var(--color-text-secondary); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: var(--font-size-xl);
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
                background: var(--color-bg-tertiary);
                border: 1px solid transparent;
                border-radius: var(--radius-lg);
                cursor: pointer;
                transition: all var(--transition-fast);
                text-align: left;
            "
            onmouseover="this.style.borderColor='var(--color-accent)'; this.style.background='var(--color-team-a-bg)';"
            onmouseout="this.style.borderColor='transparent'; this.style.background='var(--color-bg-tertiary)';"
        >
            <img src="/lane/${encodeURIComponent(lane.name)}.jpg" 
                 style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover; background: #1a1a1a;" 
                 alt="${lane.name}"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2212%22%3E${
                   lane.icon
                 }%3C/text%3E%3C/svg%3E';">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--color-text-primary); font-size: 0.95rem;">${
                  lane.label
                }</div>
                <div style="font-size: 0.8rem; color: var(--color-text-tertiary);">${
                  lane.thaiName
                }</div>
            </div>
        </button>
    `,
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

  // Swap logic same as selectHero
  const swapped = currentState ? currentState.swapped : false;
  const actualSide = swapped
    ? lanePickerSide === "A"
      ? "B"
      : "A"
    : lanePickerSide;

  const success = await postAPI("/api/player/update", {
    side: actualSide,
    slot: lanePickerSlot,
    lane: laneName,
  });

  if (success) {
    console.log(
      `✅ Lane ${
        laneName || "cleared"
      } for Team ${lanePickerSide} Player ${lanePickerSlot}`,
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
  hasHero: boolean,
): void {
  if (hasHero) {
    openLanePicker(side, slot);
  } else {
    // Show notification that hero must be selected first
    if ((window as any).showNotification) {
      (window as any).showNotification(
        "กรุณาเลือกตัวละครก่อน",
        "เลือก Hero ก่อนถึงจะเลือกตำแหน่งเลนได้",
        "warning",
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
    "teamA-template",
  ) as HTMLSelectElement;
  const teamBSelect = document.getElementById(
    "teamB-template",
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

function handleTemplateLogoSelect(input: HTMLInputElement): void {
  if (input.files && input.files[0]) {
    openCropModal(input.files[0], "TEMPLATE");
    input.value = "";
  }
}
(window as any).handleTemplateLogoSelect = handleTemplateLogoSelect;

let templateManagerOverlay: HTMLDivElement | null = null;
let templateLogoFile: File | null = null;
let editingTemplateId: string | null = null;

function openTemplateManager(): void {
  templateManagerOverlay = document.createElement("div");
  templateManagerOverlay.id = "template-manager-overlay";
  templateManagerOverlay.classList.add("modal-overlay");

  const modal = document.createElement("div");
  modal.classList.add("modal", "template-modal"); // Use new class

  // Header
  const header = document.createElement("div");
  header.classList.add("template-modal__header");
  header.innerHTML = `
        <div class="template-modal__title">
            <i class="ph-duotone ph-folders" style="color: var(--color-primary);"></i>
            Template Manager
        </div>
        <button id="close-template-manager" class="close-btn">
            <i class="ph-bold ph-x"></i>
        </button>
    `;

  // Body Container
  const body = document.createElement("div");
  body.classList.add("template-modal__body");

  // Left Panel: Create Form
  const formPanel = document.createElement("div");
  formPanel.classList.add("template-form-panel");
  formPanel.innerHTML = `
        <div class="template-form__section">
            <div class="template-form__header">
                <i class="ph-duotone ph-plus-circle"></i>
                Create New Template
            </div>
            
            <div class="template-input-group">
                <label class="template-input-label">Team Name *</label>
                <input type="text" id="tpl-name" class="template-input" placeholder="e.g. T1, LOUD, Gen.G">
            </div>

            <div class="template-input-group">
                <label class="template-input-label">Theme Color</label>
                <div class="template-color-picker">
                    <div class="template-color-preview">
                        <input type="color" id="tpl-color" value="#3b82f6">
                    </div>
                    <input type="text" id="tpl-color-text" class="template-input" value="#3b82f6" style="font-family: monospace; width: 100px;">
                </div>
            </div>

            <div class="template-input-group">
                <label class="template-input-label">Team Logo</label>
                <div class="template-logo-upload" onclick="document.getElementById('tpl-logo-input').click()">
                    <div id="tpl-logo-preview" class="template-logo-preview">
                        <i class="ph-duotone ph-image" style="color: var(--color-text-tertiary);"></i>
                    </div>
                    <div style="flex: 1;">
                        <input type="file" id="tpl-logo-input" accept="image/*" style="display: none;" onchange="handleTemplateLogoSelect(this)">
                        <div style="font-size: var(--font-size-sm); font-weight: var(--font-weight-medium);">Upload Logo</div>
                        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">PNG, JPG, SVG (Max 2MB)</div>
                    </div>
                    <i class="ph-bold ph-upload-simple" style="color: var(--color-text-secondary);"></i>
                </div>
            </div>

            <div class="template-input-group">
                <label class="template-input-label">Roster</label>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <input type="text" id="tpl-p1" class="template-input" placeholder="Player 1">
                    <input type="text" id="tpl-p2" class="template-input" placeholder="Player 2">
                    <input type="text" id="tpl-p3" class="template-input" placeholder="Player 3">
                    <input type="text" id="tpl-p4" class="template-input" placeholder="Player 4">
                    <input type="text" id="tpl-p5" class="template-input" placeholder="Player 5">
                </div>
            </div>

            <button id="create-template-btn" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 12px;">
                <i class="ph-bold ph-floppy-disk"></i>
                Save Template
            </button>
        </div>
    `;

  // Right Panel: Template List
  const listPanel = document.createElement("div");
  listPanel.classList.add("template-list-panel");

  // Header for List
  const listHeader = document.createElement("div");
  listHeader.style.cssText =
    "display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);";
  listHeader.innerHTML = `
    <div style="display: flex; align-items: center; gap: var(--space-2);">
        <span class="status-indicator">
            <span class="status-dot connected"></span>
            Saved Templates
        </span>
        <span style="background: var(--color-bg-tertiary); padding: 2px 8px; border-radius: 10px; font-size: 11px; color: var(--color-text-secondary);">${templates.length}</span>
    </div>
  `;

  const grid = document.createElement("div");
  grid.id = "template-list"; // Build grid content dynamically
  grid.className = "template-grid"; // Use grid class

  if (templates.length === 0) {
    grid.innerHTML = `
        <div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; color: var(--color-text-tertiary); gap: 10px;">
            <i class="ph-duotone ph-ghost" style="font-size: 32px; opacity: 0.5;"></i>
            <span>No templates found</span>
        </div>
      `;
  } else {
    grid.innerHTML = templates
      .map((t) => {
        const initials = t.name.substring(0, 2).toUpperCase();
        const logoHtml = t.logo
          ? `<img src="${t.logo}" alt="${t.name}">`
          : `<span style="font-weight: bold; font-size: 12px; color: ${t.color}">${initials}</span>`;

        return `
            <div class="template-card" onclick="loadTemplateToForm('${t.id}')">
                <div class="template-card__header">
                    <div class="template-card__logo">
                        ${logoHtml}
                    </div>
                    <div class="template-card__info">
                        <div class="template-card__name">${escapeHtml(t.name)}</div>
                        <div class="template-card__details">${t.players?.length || 0} Players</div>
                    </div>
                    <div class="template-card__color" style="color: ${t.color}; background: ${t.color};"></div>
                </div>
                
                <div class="template-card__actions">
                    <button class="card-btn" onclick="event.stopPropagation(); loadTemplateToForm('${t.id}')" title="Edit">
                        <i class="ph-bold ph-pencil-simple"></i>
                    </button>
                    <button class="card-btn delete" onclick="event.stopPropagation(); deleteTemplate('${t.id}')" title="Delete">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                </div>
            </div>
          `;
      })
      .join("");
  }

  listPanel.appendChild(listHeader);
  listPanel.appendChild(grid);

  // Assemble
  body.appendChild(formPanel);
  body.appendChild(listPanel);
  modal.appendChild(header);
  modal.appendChild(body);
  templateManagerOverlay.appendChild(modal);
  document.body.appendChild(templateManagerOverlay);

  // Event listeners
  const closeBtn = document.getElementById("close-template-manager");
  if (closeBtn) closeBtn.onclick = closeTemplateManager;

  templateManagerOverlay.onclick = (e) => {
    if (e.target === templateManagerOverlay) closeTemplateManager();
  };

  // Color sync
  const colorInput = document.getElementById("tpl-color") as HTMLInputElement;
  const colorText = document.getElementById(
    "tpl-color-text",
  ) as HTMLInputElement;
  const colorPreview = document.querySelector(
    ".template-color-preview",
  ) as HTMLElement;

  if (colorInput && colorText) {
    // Update text on color pick
    colorInput.oninput = () => {
      colorText.value = colorInput.value;
      if (colorPreview) colorPreview.style.borderColor = colorInput.value;
    };

    // Update picker on text input
    colorText.oninput = () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(colorText.value)) {
        colorInput.value = colorText.value;
        if (colorPreview) colorPreview.style.borderColor = colorText.value;
      }
    };
  }

  // Create button
  const createBtn = document.getElementById("create-template-btn");
  if (createBtn) createBtn.onclick = createTemplateFromForm;
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
  confirmOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
    `;

  confirmOverlay.innerHTML = `
        <div class="dialog_delete">
            <h3>are you sure ?</h3>
            <p >คุณต้องการลบ Template "${templateName}"</p>
            <p></p>
            <p style="color: #6b7280; font-size: 12px; margin-bottom: 24px;">การลบจะไม่สามารถกู้คืนได้</p>
            <div class="dialog_delete_footer">
                <button id="confirm-delete-yes">sure</button>
                <button id="confirm-delete-no">cancel</button>
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
    "tpl-color-text",
  ) as HTMLInputElement;

  if (nameInput) nameInput.value = template.name;
  if (colorInput) colorInput.value = template.color;
  if (colorText) colorText.value = template.color;

  // Populate players
  for (let i = 1; i <= 5; i++) {
    const playerInput = document.getElementById(
      `tpl-p${i}`,
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

// Expose template functions to window
(window as any).loadTemplate = loadTemplate;
(window as any).saveAsTemplate = saveAsTemplate;
(window as any).openTemplateManager = openTemplateManager;
(window as any).deleteTemplate = deleteTemplate;
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
  mode: "full" | "hero" | "lane";
} | null = null;

function handleDragStart(event: DragEvent): void {
  const card = (event.target as HTMLElement).closest(
    ".player-card",
  ) as HTMLElement;
  if (!card) return;

  // Robustly detect what we are dragging by looking at element under cursor
  // This avoids dependency on 'mousedown' global variable which might be flaky
  const sourceEl = document.elementFromPoint(event.clientX, event.clientY);

  // Check if the initial click was within the hero or lane section
  const heroSection = sourceEl?.closest(".player-card__hero");
  const laneSection = sourceEl?.closest(".player-card__role");

  // Determine drag mode
  let dragMode: "full" | "hero" | "lane" = "full";
  if (heroSection) dragMode = "hero";
  else if (laneSection) dragMode = "lane";

  // Debug
  console.log("Drag Start:", {
    cardSlot: card.dataset.slot,
    mode: dragMode,
    sourceEl: sourceEl?.className,
  });

  draggedPlayer = {
    side: card.dataset.side || "A",
    slot: parseInt(card.dataset.slot || "1"),
    mode: dragMode,
  };

  card.classList.add("dragging");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    // CRITICAL: setData is required for drag to work in many browsers (Firefox etc)
    // We can also store the data here instead of just global variable, but global is fine for internal use.
    // Just setting it allows the drag to proceed.
    event.dataTransfer.setData("text/plain", JSON.stringify(draggedPlayer));
  }
}

function handleDragEnd(event: DragEvent): void {
  const card = (event.target as HTMLElement).closest(
    ".player-card",
  ) as HTMLElement;
  if (card) {
    card.classList.remove("dragging");
  }
  // Clear drag-over from ALL cards
  document
    .querySelectorAll(".player-card")
    .forEach((c) => c.classList.remove("drag-over"));

  draggedPlayer = null;
  console.log("Drag End");
}

function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  const card = (event.target as HTMLElement).closest(
    ".player-card",
  ) as HTMLElement;
  if (!card || !draggedPlayer) return;

  const targetSide = card.dataset.side;
  if (targetSide !== draggedPlayer.side) return; // Only allow same-team drag

  card.classList.add("drag-over");
}

async function handleDrop(event: DragEvent): Promise<void> {
  event.preventDefault();
  const targetCard = (event.target as HTMLElement).closest(
    ".player-card",
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
  mode: "full" | "hero" | "lane" = "full",
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
        "success",
      );
    }
  } else if (mode === "lane") {
    // Swap ONLY Lanes
    await postAPI("/api/player/update", {
      side,
      slot: slot1,
      lane: player2.lane || "",
    });
    await postAPI("/api/player/update", {
      side,
      slot: slot2,
      lane: player1.lane || "",
    });

    if ((window as any).showNotification) {
      (window as any).showNotification(
        "Lanes Swapped",
        `Slot ${slot1} ↔ Slot ${slot2}`,
        "success",
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
        "success",
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
        "success",
      );
    } else {
      (window as any).showNotification("Captain removed", "", "info");
    }
  }
}

// ==========================================
// Exposed Roster Functions
// ==========================================

// Drag & Drop
(window as any).handleDragStart = handleDragStart;
(window as any).handleDragEnd = handleDragEnd;
(window as any).handleDragOver = handleDragOver;
(window as any).handleDrop = handleDrop;

// Hero Picker (Simple Implementation)

(window as any).openHeroPicker = openHeroPicker;

// Font Settings Logic
async function saveFontAssignment(part: string, fontId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/fonts/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [part]: fontId }),
    });
    console.log(`Saved font assignment ${part} -> ${fontId}`);
  } catch (e) {
    console.error("Failed to save font assignment", e);
  }
}
(window as any).saveFontAssignment = saveFontAssignment;

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

// Expose Lower Third / Show Info functions
(window as any).saveLowerThird = saveLowerThird;
(window as any).clearSlot = clearSlot;
(window as any).uploadSlotLogo = uploadSlotLogo;

// ==========================================
// OBS Layout Helper
// ==========================================

async function switchScene(sceneName: string): Promise<void> {
  try {
    console.log(`🎬 Switching to scene: ${sceneName}`);
    const response = await fetch(`${API_BASE}/api/obs/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneName }),
    });

    if (response.ok) {
      // Update UI active state if needed
      document.querySelectorAll(".obs-scene-btn").forEach((btn) => {
        btn.classList.remove("active");
        if (btn.querySelector("span")?.textContent === sceneName) {
          btn.classList.add("active");
        }
      });
    } else {
      console.error("Failed to switch scene");
    }
  } catch (err) {
    console.error("Switch scene error:", err);
  }
}
(window as any).switchScene = switchScene;

async function refreshScenes(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/obs/scenes`);
    if (response.ok) {
      const scenes = await response.json();
      const grid = document.getElementById("obs-scene-grid");
      if (grid) {
        grid.innerHTML = scenes
          .map(
            (scene: string) => `
                <button class="obs-scene-btn" onclick="switchScene('${scene}')">
                    <i class="ph-duotone ph-broadcast"></i>
                    <span>${scene}</span>
                </button>
            `,
          )
          .join("");
      }
    }
  } catch (err) {
    console.error("Failed to refresh scenes:", err);
  }
}

async function loadDefaultLayout(): Promise<void> {
  const btn = document.querySelector(
    'button[onclick="loadDefaultLayout()"]',
  ) as HTMLButtonElement;
  const originalText = btn ? btn.innerHTML : "";

  if (btn) {
    btn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Loading...';
    btn.disabled = true;
  }

  try {
    const response = await fetch(`${API_BASE}/api/obs/apply-layout`, {
      method: "POST",
    });

    if (response.ok) {
      console.log("✅ Layout imported successfully");
      if ((window as any).showNotification) {
        (window as any).showNotification(
          "Import Successful",
          "Layout copied to OBS. Please RESTART OBS to see 'Esport | PaperX' in Scene Collection.",
          "success",
        );
      }
      // Do not refresh scenes immediately as restart is required
    } else {
      throw new Error("Failed to load layout");
    }
  } catch (err) {
    console.error("❌ loadDefaultLayout error:", err);
    if ((window as any).showNotification) {
      (window as any).showNotification(
        "Error",
        "Could not load default layout",
        "error",
      );
    }
  } finally {
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
}

(window as any).loadDefaultLayout = loadDefaultLayout;

// ==========================================
// Font Management
// ==========================================

let currentFontsState: any = { fonts: [], assignments: {} };

async function fetchFonts(): Promise<void> {
  try {
    const [fontsRes, assignRes] = await Promise.all([
      fetch(`${API_BASE}/api/fonts`),
      fetch(`${API_BASE}/api/fonts/assignments`),
    ]);

    if (fontsRes.ok && assignRes.ok) {
      const state = await fontsRes.json();
      const assignments = await assignRes.json();

      currentFontsState = {
        fonts: state.fonts || [],
        assignments: assignments,
      };

      updateFontDropdowns();
    }
  } catch (err) {
    console.error("Failed to fetch fonts:", err);
  }
}

function updateFontDropdowns(): void {
  const assignmentKeys = [
    "lowerThirdTitle",
    "lowerThirdSlots",
    "scoreboardTeamName",
    "scoreboardScore",
    "versusTeamName",
    "bracketTeamName",
    "transitionTitle",
  ];

  const defaultLabels: Record<string, string> = {
    lowerThirdTitle: "Default (Rajdhani)",
    lowerThirdSlots: "Default (Outfit)",
    scoreboardTeamName: "Default (Rajdhani)",
    scoreboardScore: "Default (Rajdhani Bold)",
    versusTeamName: "Default (Rajdhani)",
    bracketTeamName: "Default (Inter)",
    transitionTitle: "Default (System)",
  };

  for (const key of assignmentKeys) {
    const select = document.getElementById(
      `font-assign-${key}`,
    ) as HTMLSelectElement;
    if (!select) continue;

    const currentValue = currentFontsState.assignments[key] || "";

    select.innerHTML = `<option value="">${defaultLabels[key] || "Default"}</option>`;

    for (const font of currentFontsState.fonts) {
      const selected = font.id === currentValue ? "selected" : "";
      // Escape HTML helper
      const fontName = font.name
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
      select.innerHTML += `<option value="${font.id}" ${selected}>${fontName} (${font.weight})</option>`;
    }
  }
}

async function updateFontAssignment(
  key: string,
  fontId: string,
): Promise<void> {
  currentFontsState.assignments[key] = fontId || null;

  // Auto-save immediately
  try {
    const response = await fetch(`${API_BASE}/api/fonts/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentFontsState.assignments),
    });

    if (response.ok) {
      if ((window as any).showNotification) {
        (window as any).showNotification(
          "Saved",
          "เปลี่ยนฟอนต์เรียบร้อย",
          "success",
        );
      }
    }
  } catch (err) {
    console.error("Auto-save font assignment error:", err);
  }
}

async function saveFontAssignments(): Promise<void> {
  // Legacy function support
  try {
    const response = await fetch(`${API_BASE}/api/fonts/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentFontsState.assignments),
    });

    if (response.ok) {
      if ((window as any).showNotification) {
        (window as any).showNotification(
          "Saved",
          "บันทึกการตั้งค่าฟอนต์สำเร็จ",
          "success",
        );
      }
    }
  } catch (err) {
    console.error("Save font assignments error:", err);
  }
}

(window as any).updateFontAssignment = updateFontAssignment;

(window as any).saveFontAssignments = saveFontAssignments;

// ==========================================
// Initialization
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Esport Control Panel Initializing...");

  // Fetch initial state via REST API
  fetchInitialState();

  // Fetch templates
  fetchTemplates();

  // Fetch fonts
  fetchFonts();

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

  // ==========================================
  // Show Info / Lower Third File Inputs
  // ==========================================

  // Transition Logo Upload
  const transitionLogoInput = document.getElementById(
    "transition-logo-input",
  ) as HTMLInputElement;
  if (transitionLogoInput) {
    transitionLogoInput.addEventListener("change", async () => {
      const file = transitionLogoInput.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("logo", file);

      try {
        const response = await fetch(`${API_BASE}/api/transition/logo`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          // Update preview
          const preview = document.getElementById("transition-logo-preview");
          if (preview && result.path) {
            preview.style.backgroundImage = `url('${result.path}?t=${Date.now()}')`;
            preview.innerHTML = ""; // Remove icon
          }
          console.log("✅ Transition logo uploaded");
          if ((window as any).showNotification) {
            (window as any).showNotification(
              "Logo Uploaded",
              "Transition logo updated",
              "success",
            );
          }
        }
      } catch (err) {
        console.error("❌ Transition logo upload error:", err);
      }
    });
  }

  // Slot Logo Uploads
  [1, 2, 3].forEach((slotId) => {
    const input = document.getElementById(
      `slot-${slotId}-logo-input`,
    ) as HTMLInputElement;
    if (input) {
      input.addEventListener("change", () => uploadSlotLogo(slotId, input));
    }
  });

  // Load Lower Third state on init
  loadLowerThird();

  // Load Transition Logo preview
  (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/transition/logo`);
      if (response.ok) {
        const result = await response.json();
        if (result.path) {
          const preview = document.getElementById("transition-logo-preview");
          if (preview) {
            preview.style.backgroundImage = `url('${result.path}?t=${Date.now()}')`;
            preview.innerHTML = "";
          }
        }
      }
    } catch (e) {
      console.log("No transition logo found");
    }
  })();
});

// ==========================================
// Bracket Logic
// ==========================================

let currentBracketType: "single" | "double" = "single";

function setBracketType(type: "single" | "double"): void {
  currentBracketType = type;
  document
    .getElementById("bracket-type-single")
    ?.classList.toggle("btn-primary", type === "single");
  document
    .getElementById("bracket-type-single")
    ?.classList.toggle("btn-secondary", type !== "single");
  document
    .getElementById("bracket-type-double")
    ?.classList.toggle("btn-primary", type === "double");
  document
    .getElementById("bracket-type-double")
    ?.classList.toggle("btn-secondary", type !== "double");
}

let selectionSequence: string[] = [];
(window as any).selectionSequence = selectionSequence;

function handleTeamSelection(
  checkbox: HTMLInputElement,
  teamName: string,
): void {
  if (checkbox.checked) {
    if (!selectionSequence.includes(teamName)) {
      selectionSequence.push(teamName);
    }
  } else {
    selectionSequence = selectionSequence.filter((name) => name !== teamName);
  }
  refreshSelectionBadges();
  updateSelectedCount();
}
(window as any).handleTeamSelection = handleTeamSelection;

function refreshSelectionBadges(): void {
  document.querySelectorAll(".bracket-team-card").forEach((card: any) => {
    const name = card.dataset.name;
    const index = selectionSequence.indexOf(name);
    const badge = card.querySelector(".sequence-badge") as HTMLElement;
    const checkbox = card.querySelector("input") as HTMLInputElement;

    if (index !== -1) {
      // Selected
      card.style.borderColor = "var(--color-primary)";
      card.style.background = "var(--color-bg-secondary)";
      if (badge) {
        badge.style.display = "flex";
        badge.textContent = (index + 1).toString();
      }
      if (checkbox) checkbox.checked = true;
    } else {
      // Not selected
      card.style.borderColor = "transparent";
      card.style.background = "var(--color-bg-tertiary)";
      if (badge) badge.style.display = "none";
      if (checkbox) checkbox.checked = false;
    }
  });
}

async function loadBracketTemplates(): Promise<void> {
  try {
    const list = document.getElementById("bracket-template-list");
    if (!list) return;

    const response = await fetch(`${API_BASE}/api/templates`);
    if (response.ok) {
      const templates = await response.json();

      if (templates.length === 0) {
        list.innerHTML = `
            <div style="color: var(--color-text-tertiary); font-size: var(--font-size-sm); grid-column: 1 / -1; text-align: center; padding: var(--space-4);">
                <i class="ph-duotone ph-folder-open" style="font-size: 24px; display: block; margin-bottom: var(--space-2);"></i>
                No templates found. Create templates first in the Template Manager.
            </div>`;
        return;
      }

      list.innerHTML = templates
        .map(
          (t: any) => `
        <label style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: var(--color-bg-tertiary);
            border: 1px solid transparent;
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: all 0.2s;
            position: relative;
        " class="bracket-team-card" data-name="${t.name}">
            <input type="checkbox" 
                data-template='${JSON.stringify(t).replace(/'/g, "&#039;")}'
                onchange="handleTeamSelection(this, '${t.name}')"
                style="width: 18px; height: 18px; accent-color: var(--color-primary);">
            
            ${
              t.logo
                ? `<img src="${t.logo}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: cover;">`
                : `<div style="width: 24px; height: 24px; border-radius: 4px; background: ${t.color || "#3b82f6"}; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: white;">${t.name.substring(0, 2).toUpperCase()}</div>`
            }
            <span style="flex: 1; font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.name}</span>
            
            <!-- Sequence Badge Inline -->
            <span class="sequence-badge" style="
                display: none;
                background: var(--color-primary);
                color: white;
                font-size: 10px;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: var(--space-2);
            "></span>
        </label>
    `,
        )
        .join("");

      // Re-apply states if any selection exists
      refreshSelectionBadges();
    }
  } catch (err) {
    console.error("Failed to load bracket templates:", err);
  }
}

function updateSelectedCount(): void {
  const checkboxes = document.querySelectorAll(".template-checkbox:checked");
  const countSpan = document.getElementById("bracket-selected-count");
  if (countSpan) {
    countSpan.textContent = `${checkboxes.length} selected`;
  }
}

async function createBracket(): Promise<void> {
  const nameInput = document.getElementById("bracket-name") as HTMLInputElement;

  // Validate Name - Fixes "Haven't named tournament yet" bug
  const name = nameInput?.value?.trim();
  if (!name) {
    if ((window as any).showNotification) {
      (window as any).showNotification(
        "Validation Error",
        "Please enter a tournament name",
        "warning",
      );
    } else {
      alert("Please enter a tournament name");
    }
    nameInput?.focus();
    return;
  }

  // Update selector to match index.html's generated structure
  // It renders generic checkboxes inside #bracket-template-list
  // using parent label .bracket-team-card
  const list = document.getElementById("bracket-template-list");
  let teams: { id: string; name: string }[] = [];

  if (list) {
    // Try getting checked inputs
    const checkedInputs = list.querySelectorAll(
      'input[type="checkbox"]:checked',
    );

    teams = Array.from(checkedInputs).map((input: any) => {
      console.log("Input:", input);
      console.log("Dataset:", input.dataset);

      // index.html stores full template in data-template, or name in data-name/parent
      // Let's try to parse data-template if available
      if (input.dataset.template) {
        try {
          const t = JSON.parse(input.dataset.template);
          console.log("Parsed template:", t);
          return { id: t.id, name: t.name };
        } catch (e) {
          console.error("Error parsing template data", e);
        }
      }

      // Fallback to finding name from UI or other attributes
      // The index.html version puts name in onchange handler or parent data-name
      // Let's check parent label data-name as fallback
      const parent = input.closest(".bracket-team-card");
      if (parent && parent.dataset.name) {
        return { id: parent.dataset.name, name: parent.dataset.name }; // Use name as ID if needed
      }

      return { id: input.value, name: "Unknown" };
    });
  }

  if (teams.length < 2) {
    if ((window as any).showNotification) {
      (window as any).showNotification(
        "Validation Error",
        "Please select at least 2 teams",
        "warning",
      );
    } else {
      alert("Please select at least 2 teams");
    }
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/bracket/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        type: currentBracketType,
        teams: teams.map((t) => t.name), // Just names for simplicity as per existing API
      }),
    });

    if (response.ok) {
      const data = await response.json();
      renderBracket(data.bracket);
    } else {
      alert("Failed to create bracket");
    }
  } catch (err) {
    console.error("Create bracket error:", err);
  }
}

async function fetchBracket(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/bracket`);
    if (response.ok) {
      const bracket = await response.json();
      if (bracket && bracket.matches && bracket.matches.length > 0) {
        renderBracket(bracket);
      } else {
        document.getElementById("bracket-create-section")!.style.display =
          "block";
        document.getElementById("bracket-display")!.style.display = "none";

        // Ensure the list is populated with the correct "Fancy" UI
        loadBracketTemplates();
      }
    }
  } catch (err) {
    console.error("Fetch bracket error:", err);
  }
}

function renderBracket(bracket: any): void {
  const display = document.getElementById("bracket-display");
  const createSection = document.getElementById("bracket-create-section");
  const container = document.getElementById("bracket-container");
  const title = document.getElementById("bracket-title");
  const info = document.getElementById("bracket-info");

  if (!display || !createSection || !container || !title) return;

  if (!bracket) {
    createSection.style.display = "block";
    display.style.display = "none";
    return;
  }

  createSection.style.display = "none";
  display.style.display = "block";
  title.textContent = bracket.name;
  if (info) {
    info.textContent = `${bracket.teams.length} Teams • ${bracket.type === "single" ? "Single" : "Double"} Elimination`;
  }

  container.innerHTML = "";

  // Group matches by round
  const rounds: { [key: number]: any[] } = {};
  bracket.matches.forEach((match: any) => {
    if (!rounds[match.round]) rounds[match.round] = [];
    rounds[match.round].push(match);
  });

  // Render each round
  Object.keys(rounds)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach((roundNum) => {
      const roundEl = document.createElement("div");
      roundEl.className = "bracket-round";
      roundEl.style.cssText =
        "display: flex; flex-direction: column; gap: var(--space-4); min-width: 280px;";

      const roundHeader = document.createElement("div");
      roundHeader.style.cssText =
        "font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: var(--space-2);";

      const firstMatch = rounds[parseInt(roundNum)][0];
      roundHeader.textContent =
        firstMatch.roundName?.split(" ").slice(0, -1).join(" ") ||
        `Round ${roundNum}`;
      roundEl.appendChild(roundHeader);

      rounds[parseInt(roundNum)].forEach((match: any) => {
        const matchEl = createMatchElement(match);
        roundEl.appendChild(matchEl);
      });

      container.appendChild(roundEl);
    });
}

function createMatchElement(match: any): HTMLElement {
  const matchEl = document.createElement("div");
  matchEl.className = "bracket-match";
  matchEl.style.cssText = `
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          padding: var(--space-3);
          margin-bottom: var(--space-2);
      `;

  // Round title
  const titleRow = document.createElement("div");
  titleRow.style.cssText =
    "display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);";
  titleRow.innerHTML = `
          <span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${match.roundName || ""}</span>
          ${match.isBye ? '<span style="font-size: var(--font-size-xs); color: var(--color-warning); font-weight: var(--font-weight-semibold);">BYE</span>' : ""}
      `;
  matchEl.appendChild(titleRow);

  // Team A
  const teamAEl = createTeamRow(match, "A", match.teamA);
  matchEl.appendChild(teamAEl);

  // Team B
  const teamBEl = createTeamRow(match, "B", match.teamB);
  matchEl.appendChild(teamBEl);

  return matchEl;
}

function createTeamRow(match: any, side: "A" | "B", team: any): HTMLElement {
  const isWinner = match.winner === side; // Backend uses 'A' or 'B'
  const teamEl = document.createElement("div");
  teamEl.style.cssText = `
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2);
          border-radius: var(--radius-sm);
          background: ${isWinner ? "var(--color-success-bg, rgba(34, 197, 94, 0.1))" : "transparent"};
          border: 1px solid ${isWinner ? "var(--color-success, #22c55e)" : "var(--color-border-light)"};
          margin-bottom: var(--space-1);
      `;

  // Winner checkbox
  const checkbox = document.createElement("button");
  checkbox.style.cssText = `
          width: 24px;
          height: 24px;
          border-radius: var(--radius-sm);
          border: 2px solid ${isWinner ? "var(--color-success, #22c55e)" : "var(--color-border)"};
          background: ${isWinner ? "var(--color-success, #22c55e)" : "transparent"};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          transition: all 0.2s;
      `;
  checkbox.innerHTML = isWinner ? '<i class="ph-bold ph-check"></i>' : "";
  checkbox.disabled = !team || match.isBye;
  checkbox.onclick = () => setMatchWinner(match.id, side);
  teamEl.appendChild(checkbox);

  // Team name
  const nameEl = document.createElement("span");
  nameEl.style.cssText = `
          flex: 1;
          font-weight: ${isWinner ? "var(--font-weight-semibold)" : "var(--font-weight-normal)"};
          color: ${team ? "var(--color-text-primary)" : "var(--color-text-tertiary)"};
      `;
  nameEl.textContent = team ? team.name : "TBA";
  teamEl.appendChild(nameEl);

  // Score input
  const scoreInput = document.createElement("input");
  scoreInput.type = "number";
  scoreInput.min = "0";
  scoreInput.value = (side === "A" ? match.scoreA : match.scoreB) || 0;
  scoreInput.style.cssText = `
          width: 50px;
          padding: var(--space-1) var(--space-2);
          text-align: center;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-sm);
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
      `;
  scoreInput.disabled = !team;
  scoreInput.onchange = (e) =>
    updateMatchScore(
      match.id,
      side,
      parseInt((e.target as HTMLInputElement).value) || 0,
    );
  teamEl.appendChild(scoreInput);

  return teamEl;
}

async function setMatchWinner(
  matchId: number,
  winner: "A" | "B",
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/bracket/match/winner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, winner }),
    });

    const result = await response.json();
    if (result.success) {
      renderBracket(result.bracket);
      if ((window as any).showNotification) {
        (window as any).showNotification(
          "Winner Set",
          "Match updated successfully",
          "success",
        );
      }
    }
  } catch (err) {
    console.error("Set winner error:", err);
  }
}

async function updateMatchScore(
  matchId: number,
  side: "A" | "B",
  score: number,
): Promise<void> {
  try {
    const body: any = { matchId };
    if (side === "A") body.scoreA = score;
    else body.scoreB = score;

    const response = await fetch(`${API_BASE}/api/bracket/match/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (result.success) {
      renderBracket(result.bracket); // Re-render to ensure consistency
    }
  } catch (err) {
    console.error("Update score error:", err);
  }
}

async function shuffleBracketTeams(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/bracket/shuffle`, {
      method: "POST",
    });
    const result = await response.json();

    if (result.success) {
      renderBracket(result.bracket);
      if ((window as any).showNotification) {
        (window as any).showNotification(
          "Shuffled!",
          "Team matchups have been randomized",
          "success",
        );
      }
    } else if (result.locked) {
      if ((window as any).showNotification) {
        (window as any).showNotification(
          "Locked",
          "Cannot shuffle after scoring has started",
          "warning",
        );
      }
      updateShuffleButtonState(true);
    } else {
      alert(result.message || "Shuffle failed");
    }
  } catch (err) {
    console.error("Shuffle bracket error:", err);
  }
}

function updateShuffleButtonState(locked: boolean): void {
  const btn = document.getElementById("bracket-shuffle-btn");
  if (!btn) return;

  if (locked) {
    btn.setAttribute("disabled", "true");
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
    btn.title = "Shuffle locked - scoring has started";
    btn.innerHTML = '<i class="ph-bold ph-lock"></i> Locked';
  } else {
    btn.removeAttribute("disabled");
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.title = "Re-shuffle team matchups";
    btn.innerHTML = '<i class="ph-bold ph-shuffle"></i> Shuffle';
  }
}

function shuffleSelectedTeams(): void {
  const container = document.getElementById("bracket-template-list");
  if (!container) return;

  const labels = Array.from(container.querySelectorAll("label"));

  // Check if we have selected teams
  const selectedCount = labels.filter((l) =>
    l.querySelector("input:checked"),
  ).length;

  if (selectedCount < 2) {
    if ((window as any).showNotification) {
      (window as any).showNotification(
        "Shuffle",
        "Please select at least 2 teams to shuffle",
        "warning",
      );
    } else {
      alert("Please select at least 2 teams to shuffle");
    }
    return;
  }

  // Fisher-Yates shuffle
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    container.insertBefore(labels[j], labels[i]);
  }

  if ((window as any).showNotification) {
    (window as any).showNotification(
      "Shuffled!",
      "Team order has been randomized",
      "success",
    );
  }
}
(window as any).shuffleSelectedTeams = shuffleSelectedTeams;

async function resetBracket(): Promise<void> {
  console.log("🗑️ Resetting bracket...");

  try {
    const response = await fetch(`${API_BASE}/api/bracket`, {
      method: "DELETE",
    });
    if (response.ok) {
      document.getElementById("bracket-display")!.style.display = "none";
      document.getElementById("bracket-create-section")!.style.display =
        "block";

      // Clear tournament name
      const nameInput = document.getElementById(
        "bracket-name",
      ) as HTMLInputElement;
      if (nameInput) nameInput.value = "";

      // Clear selection
      selectionSequence = [];
      refreshSelectionBadges();
      updateSelectedCount();

      loadBracketTemplates(); // Refresh list
      if ((window as any).showNotification) {
        (window as any).showNotification(
          "Reset",
          "Bracket has been reset",
          "info",
        );
      }
    }
  } catch (err) {
    console.error("Reset bracket error:", err);
  }
}

function copyBracketOverlayUrl(): void {
  const url = `${window.location.origin}/bracket.html`;
  navigator.clipboard.writeText(url).then(() => {
    if ((window as any).showNotification) {
      (window as any).showNotification(
        "Copied",
        "Bracket overlay URL copied to clipboard",
        "success",
      );
    }
  });
}

// Main entry point
(window as any).setBracketType = setBracketType;
(window as any).createBracket = createBracket;
(window as any).resetBracket = resetBracket;
(window as any).shuffleBracketTeams = shuffleBracketTeams;
(window as any).copyBracketOverlayUrl = copyBracketOverlayUrl;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  fetchBracket();
});
