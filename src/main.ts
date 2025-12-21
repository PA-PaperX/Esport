// ==========================================
// Interfaces (Strict Typing)
// ==========================================

interface Player {
    slot: number;
    name: string;
    realName?: string;
    hero?: string;
}

interface Team {
    name: string;
    shortName: string;
    color: string;
    logo: string;
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

const elements = {
    statusDot: () => getElement<HTMLDivElement>('status-dot'),
    connectionStatus: () => getElement<HTMLDivElement>('connection-status'),
    teamAName: () => getElement<HTMLInputElement>('teamA-name'),
    teamAColor: () => getElement<HTMLInputElement>('teamA-color'),
    teamAColorHex: () => getElement<HTMLSpanElement>('teamA-color-hex'),
    teamAScore: () => getElement<HTMLInputElement>('teamA-score'),
    teamAPlayers: () => getElement<HTMLDivElement>('teamA-players'),
    teamALogoPreview: () => getElement<HTMLDivElement>('teamA-logo-preview'),
    teamALogoInput: () => getElement<HTMLInputElement>('teamA-logo-input'),
    teamBName: () => getElement<HTMLInputElement>('teamB-name'),
    teamBColor: () => getElement<HTMLInputElement>('teamB-color'),
    teamBColorHex: () => getElement<HTMLSpanElement>('teamB-color-hex'),
    teamBScore: () => getElement<HTMLInputElement>('teamB-score'),
    teamBPlayers: () => getElement<HTMLDivElement>('teamB-players'),
    teamBLogoPreview: () => getElement<HTMLDivElement>('teamB-logo-preview'),
    teamBLogoInput: () => getElement<HTMLInputElement>('teamB-logo-input'),
};

// ==========================================
// WebSocket Connection
// ==========================================

function updateConnectionStatus(connected: boolean): void {
    const dot = elements.statusDot();
    const status = elements.connectionStatus();

    if (dot) {
        dot.classList.remove('bg-red-500', 'bg-green-500');
        dot.classList.add(connected ? 'bg-green-500' : 'bg-red-500');
        dot.classList.toggle('animate-pulse', !connected);
    }

    if (status) {
        status.textContent = connected ? 'CONNECTED' : 'DISCONNECTED';
        status.classList.remove('text-red-400', 'text-green-400');
        status.classList.add(connected ? 'text-green-400' : 'text-red-400');
    }
}

function connectWebSocket(): void {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    console.log('🔌 Connecting to WebSocket...');
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('✅ WebSocket Connected');
        updateConnectionStatus(true);

        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };

    ws.onmessage = (event: MessageEvent) => {
        try {
            const message: WSMessage = JSON.parse(event.data);

            if (message.type === 'STATE_UPDATE' && message.data) {
                currentState = message.data;
                renderUI();
            }
        } catch (err) {
            console.error('❌ Failed to parse WebSocket message:', err);
        }
    };

    ws.onclose = () => {
        console.log('🔌 WebSocket Disconnected');
        updateConnectionStatus(false);
        scheduleReconnect();
    };

    ws.onerror = (error) => {
        console.error('❌ WebSocket Error:', error);
        ws?.close();
    };
}

function scheduleReconnect(): void {
    if (!reconnectInterval) {
        reconnectInterval = window.setInterval(() => {
            console.log('🔄 Attempting to reconnect...');
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
        console.error('❌ Failed to fetch initial state:', err);
    }
}

async function postAPI(endpoint: string, body: object): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        renderTeamData('A', currentState.teams.B); // Left panel shows Team B data
        renderTeamData('B', currentState.teams.A); // Right panel shows Team A data
    } else {
        renderTeamData('A', currentState.teams.A); // Normal: Left = Team A
        renderTeamData('B', currentState.teams.B); // Normal: Right = Team B
    }

    // Update swap status
    const swapStatus = document.getElementById('swap-status');
    if (swapStatus) {
        swapStatus.textContent = swapped ? '🔀 สลับฝั่ง' : 'ปกติ';
    }

    // Update button labels and colors based on swap state
    const teamABtn = document.querySelector('#teamA-section button[onclick*="saveTeam"]') as HTMLButtonElement;
    const teamBBtn = document.querySelector('#teamB-section button[onclick*="saveTeam"]') as HTMLButtonElement;

    if (teamABtn) {
        teamABtn.textContent = swapped ? 'UPDATE TEAM B' : 'UPDATE TEAM A';
        // Swap button colors
        teamABtn.classList.remove('bg-blue-600', 'hover:bg-blue-500', 'bg-red-600', 'hover:bg-red-500', 'shadow-blue-600/20', 'shadow-red-600/20');
        if (swapped) {
            teamABtn.classList.add('bg-red-600', 'hover:bg-red-500', 'shadow-red-600/20');
        } else {
            teamABtn.classList.add('bg-blue-600', 'hover:bg-blue-500', 'shadow-blue-600/20');
        }
    }
    if (teamBBtn) {
        teamBBtn.textContent = swapped ? 'UPDATE TEAM A' : 'UPDATE TEAM B';
        // Swap button colors
        teamBBtn.classList.remove('bg-blue-600', 'hover:bg-blue-500', 'bg-red-600', 'hover:bg-red-500', 'shadow-blue-600/20', 'shadow-red-600/20');
        if (swapped) {
            teamBBtn.classList.add('bg-blue-600', 'hover:bg-blue-500', 'shadow-blue-600/20');
        } else {
            teamBBtn.classList.add('bg-red-600', 'hover:bg-red-500', 'shadow-red-600/20');
        }
    }
}

// Render team data into a specific panel (side = panel position, team = data to show)
function renderTeamData(side: 'A' | 'B', team: Team): void {
    const nameInput = side === 'A' ? elements.teamAName() : elements.teamBName();
    const colorInput = side === 'A' ? elements.teamAColor() : elements.teamBColor();
    const colorHex = side === 'A' ? elements.teamAColorHex() : elements.teamBColorHex();
    const scoreInput = side === 'A' ? elements.teamAScore() : elements.teamBScore();
    const playersContainer = side === 'A' ? elements.teamAPlayers() : elements.teamBPlayers();

    if (nameInput) nameInput.value = team.name;
    if (colorInput) colorInput.value = team.color;
    if (colorHex) colorHex.textContent = team.color;
    if (scoreInput) scoreInput.value = String(team.score);

    // Render players
    if (playersContainer) {
        renderPlayers(side, team.players, playersContainer);
    }

    // Render logo preview
    const logoPreview = side === 'A' ? elements.teamALogoPreview() : elements.teamBLogoPreview();
    if (logoPreview) {
        if (team.logo) {
            logoPreview.innerHTML = `<img src="${team.logo}" alt="${team.name} Logo" class="w-full h-full object-contain">`;
        } else {
            logoPreview.innerHTML = '<span class="text-gray-500 text-xs">No Logo</span>';
        }
    }

    // Apply theme color to section
    applyThemeColor(side, team.color);

    // Update color hex on change
    colorInput?.addEventListener('input', () => {
        if (colorHex) colorHex.textContent = colorInput.value;
    });
}

function applyThemeColor(side: 'A' | 'B', color: string): void {
    const section = document.getElementById(`team${side}-section`);
    const header = document.getElementById(`team${side}-header`);
    const accent = document.getElementById(`team${side}-accent`);
    const card = document.getElementById(`team${side}-card`);

    // Parse color to get RGB for shadow
    const rgb = hexToRgb(color);
    const shadowColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` : 'rgba(100, 100, 100, 0.15)';

    if (section) {
        section.style.borderLeftColor = side === 'A' ? color : '';
        section.style.borderRightColor = side === 'B' ? color : '';
    }
    if (header) {
        header.style.color = color;
    }
    if (accent) {
        accent.style.background = color;
    }
    if (card) {
        card.style.borderColor = color;
        card.style.boxShadow = `0 0 20px ${shadowColor}`;
    }
}

function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function renderPlayers(side: 'A' | 'B', players: Player[], container: HTMLDivElement): void {
    const colorClass = side === 'A' ? 'focus:border-blue-500' : 'focus:border-red-500';
    const buttonColor = side === 'A' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500';

    container.innerHTML = players.map((player) => `
    <div class="flex items-center gap-2">
      <span class="w-6 h-6 flex items-center justify-center bg-gray-700 rounded text-xs font-bold">${player.slot}</span>
      <input 
        type="text" 
        value="${escapeHtml(player.name)}" 
        onchange="updatePlayer('${side}', ${player.slot}, this.value)"
        class="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white ${colorClass} focus:outline-none transition text-sm"
        placeholder="Player ${player.slot}"
      />
      <button 
        onclick="openHeroPicker('${side}', ${player.slot})"
        class="px-3 py-2 ${buttonColor} text-white text-xs rounded transition truncate max-w-24"
        title="${player.hero || 'Select Hero'}"
      >
        ${player.hero ? escapeHtml(player.hero) : '🎮 Hero'}
      </button>
    </div>
  `).join('');
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// Action Handlers (Exposed to Window)
// ==========================================

async function saveTeam(side: 'A' | 'B'): Promise<void> {
    const nameInput = side === 'A' ? elements.teamAName() : elements.teamBName();
    const colorInput = side === 'A' ? elements.teamAColor() : elements.teamBColor();

    if (!nameInput || !colorInput) return;

    // When swapped, left panel (A) contains Team B data, right panel (B) contains Team A data
    const swapped = currentState?.swapped || false;
    const actualSide = swapped ? (side === 'A' ? 'B' : 'A') : side;

    const success = await postAPI('/api/team/update', {
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

async function adjustScore(side: 'A' | 'B', delta: number): Promise<void> {
    if (!currentState) return;

    const team = currentState.teams[side];
    const newScore = Math.max(0, team.score + delta);

    const success = await postAPI('/api/team/update', {
        side,
        score: newScore,
    });

    if (success) {
        console.log(`✅ Score ${side} updated: ${newScore}`);
    } else {
        console.error(`❌ Failed to update score for Team ${side}`);
    }
}

async function swapSides(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/api/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const result = await response.json();
            updateSwapUI(result.swapped);
            console.log(`✅ Sides swapped: ${result.swapped ? 'Team A → Right, Team B → Left' : 'Normal'}`);
        } else {
            console.error('❌ Swap failed');
        }
    } catch (err) {
        console.error('❌ Swap error:', err);
    }
}

// Trigger transition animation
async function triggerTransition(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/api/transition/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            console.log('🎬 Transition triggered!');
        } else {
            console.error('❌ Transition trigger failed');
        }
    } catch (err) {
        console.error('❌ Transition error:', err);
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
    const img = document.getElementById('transition-logo-img') as HTMLImageElement;
    const placeholder = document.getElementById('transition-logo-placeholder');
    const status = document.getElementById('transition-logo-status');

    if (img && placeholder) {
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target?.result as string;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    if (status) {
        status.textContent = `📁 เลือก: ${file.name} → กด Upload`;
        status.className = 'text-xs text-yellow-400 text-center';
    }
    console.log('📁 Transition logo selected:', file.name);
}

async function uploadTransitionLogo(): Promise<void> {
    const status = document.getElementById('transition-logo-status');

    if (!transitionLogoFile) {
        console.log('⚠️ No logo file selected');
        if (status) {
            status.textContent = '⚠️ กรุณาเลือกรูปก่อน!';
            status.className = 'text-xs text-red-400 text-center';
        }
        return;
    }

    if (status) {
        status.textContent = '⏳ กำลังอัปโหลด...';
        status.className = 'text-xs text-blue-400 text-center';
    }

    const formData = new FormData();
    formData.append('logo', transitionLogoFile);

    try {
        const response = await fetch(`${API_BASE}/api/transition/logo`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Transition logo uploaded:', result.path);
            if (status) {
                status.textContent = '✅ อัปโหลดสำเร็จ!';
                status.className = 'text-xs text-green-400 text-center';
            }
            transitionLogoFile = null;
        } else {
            console.error('❌ Failed to upload transition logo');
            if (status) {
                status.textContent = '❌ อัปโหลดล้มเหลว';
                status.className = 'text-xs text-red-400 text-center';
            }
        }
    } catch (err) {
        console.error('❌ Transition logo upload error:', err);
        if (status) {
            status.textContent = '❌ เกิดข้อผิดพลาด';
            status.className = 'text-xs text-red-400 text-center';
        }
    }
}

// Combined function: select and upload in one step
async function uploadTransitionLogoFromInput(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    const img = document.getElementById('transition-logo-img') as HTMLImageElement;
    const placeholder = document.getElementById('transition-logo-placeholder');
    const status = document.getElementById('transition-logo-status');

    // Show preview immediately
    if (img && placeholder) {
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target?.result as string;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    // Update status
    if (status) status.textContent = '⏳ กำลังอัปโหลด...';

    const formData = new FormData();
    formData.append('logo', file);

    try {
        const response = await fetch(`${API_BASE}/api/transition/logo`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Transition logo uploaded:', result.path);
            if (status) status.textContent = '✅ อัปโหลดสำเร็จ!';
        } else {
            console.error('❌ Failed to upload transition logo');
            if (status) status.textContent = '❌ อัปโหลดล้มเหลว';
        }
    } catch (err) {
        console.error('❌ Transition logo upload error:', err);
        if (status) status.textContent = '❌ เกิดข้อผิดพลาด';
    }
}

// Load current transition logo on page load
async function loadTransitionLogo(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/api/transition/logo`);
        if (response.ok) {
            const result = await response.json();
            if (result.path) {
                const img = document.getElementById('transition-logo-img') as HTMLImageElement;
                const placeholder = document.getElementById('transition-logo-placeholder');
                if (img && placeholder) {
                    img.src = result.path;
                    img.classList.remove('hidden');
                    placeholder.classList.add('hidden');
                }
            }
        }
    } catch (err) {
        console.log('No transition logo found');
    }
}

// ==========================================
// Lower Third Functions
// ==========================================

// Update Lower Third settings
async function updateLowerThird(): Promise<void> {
    const enabled = (document.getElementById('lower-third-enabled') as HTMLInputElement)?.checked;
    const title = (document.getElementById('lower-third-title') as HTMLInputElement)?.value || '';

    const slots = [1, 2, 3].map(id => ({
        id,
        enabled: (document.getElementById(`slot-${id}-enabled`) as HTMLInputElement)?.checked ?? true,
        type: 'text' as const,
        logoPath: '',
        text: (document.getElementById(`slot-${id}-text`) as HTMLInputElement)?.value || '',
        label: (document.getElementById(`slot-${id}-text`) as HTMLInputElement)?.value || ''
    }));

    try {
        const response = await fetch(`${API_BASE}/api/lower-third`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled, title, slots })
        });

        if (response.ok) {
            console.log('✅ Lower Third updated');
        } else {
            console.error('❌ Failed to update Lower Third');
        }
    } catch (err) {
        console.error('❌ Lower Third update error:', err);
    }
}

// Upload logo for specific slot
async function uploadSlotLogo(slotId: number, input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
        const response = await fetch(`${API_BASE}/api/lower-third/slot/${slotId}/logo`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            console.log(`✅ Slot ${slotId} logo uploaded`);
        } else {
            console.error(`❌ Failed to upload slot ${slotId} logo`);
        }
    } catch (err) {
        console.error('❌ Slot logo upload error:', err);
    }
}

// Load Lower Third state on page load
async function loadLowerThird(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/api/lower-third`);
        if (response.ok) {
            const state = await response.json();

            // Update UI from state
            const enabledEl = document.getElementById('lower-third-enabled') as HTMLInputElement;
            const titleEl = document.getElementById('lower-third-title') as HTMLInputElement;

            if (enabledEl) enabledEl.checked = state.enabled;
            if (titleEl) titleEl.value = state.title || '';

            state.slots?.forEach((slot: { id: number; enabled: boolean; text: string }) => {
                const slotEnabled = document.getElementById(`slot-${slot.id}-enabled`) as HTMLInputElement;
                const slotText = document.getElementById(`slot-${slot.id}-text`) as HTMLInputElement;

                if (slotEnabled) slotEnabled.checked = slot.enabled;
                if (slotText) slotText.value = slot.text || '';
            });
        }
    } catch (err) {
        console.log('Failed to load Lower Third state');
    }
}

// ==========================================
// Settings Menu Functions
// ==========================================

function toggleSettingsMenu(): void {
    const menu = document.getElementById('settings-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// Switch between pages (Scoreboard / Broadcast)
let currentPage: string = 'scoreboard';

function switchPage(page: string): void {
    currentPage = page;

    // Hide all pages
    const pageScoreboard = document.getElementById('page-scoreboard');
    const pageBroadcast = document.getElementById('page-broadcast');

    if (pageScoreboard) pageScoreboard.classList.add('hidden');
    if (pageBroadcast) pageBroadcast.classList.add('hidden');

    // Show selected page
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.remove('hidden');

    // Update nav menu styling
    const navScoreboard = document.getElementById('nav-scoreboard');
    const navBroadcast = document.getElementById('nav-broadcast');

    const activeClasses = 'text-white bg-purple-600/20 border-l-4 border-purple-500';
    const inactiveClasses = 'text-gray-300 hover:text-white border-l-4 border-transparent';

    if (navScoreboard && navBroadcast) {
        if (page === 'scoreboard') {
            navScoreboard.className = `w-full text-left px-4 py-3 hover:bg-gray-700 transition flex items-center gap-3 ${activeClasses}`;
            navBroadcast.className = `w-full text-left px-4 py-3 hover:bg-gray-700 transition flex items-center gap-3 ${inactiveClasses}`;
        } else {
            navScoreboard.className = `w-full text-left px-4 py-3 hover:bg-gray-700 transition flex items-center gap-3 ${inactiveClasses}`;
            navBroadcast.className = `w-full text-left px-4 py-3 hover:bg-gray-700 transition flex items-center gap-3 ${activeClasses}`;
        }
    }

    // Close menu
    toggleSettingsMenu();
    console.log(`📄 Switched to page: ${page}`);
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('settings-menu');
    const hamburger = document.getElementById('hamburger-btn');
    if (menu && hamburger && !menu.contains(e.target as Node) && !hamburger.contains(e.target as Node)) {
        menu.classList.add('hidden');
    }
});

let mainLogoFile: File | null = null;

function handleMainLogoSelect(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;

    mainLogoFile = file;
    const preview = document.getElementById('main-logo-preview');
    if (preview) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target?.result}" class="w-full h-full object-contain">`;
        };
        reader.readAsDataURL(file);
    }
}

async function saveGeneralSettings(): Promise<void> {
    const eventName = (document.getElementById('event-name') as HTMLInputElement)?.value || '';
    const transitionColor = (document.getElementById('transition-color') as HTMLInputElement)?.value || '#202224';

    console.log('💾 Saving general settings:', { eventName, transitionColor });

    // Save to localStorage for now
    localStorage.setItem('esport-event-name', eventName);
    localStorage.setItem('esport-transition-color', transitionColor);

    // If logo file selected, upload it
    if (mainLogoFile) {
        const formData = new FormData();
        formData.append('logo', mainLogoFile);
        formData.append('type', 'main');

        try {
            const response = await fetch(`${API_BASE}/api/settings/logo`, {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                console.log('✅ Main logo uploaded');
            }
        } catch (err) {
            console.error('❌ Logo upload error:', err);
        }
    }

    // Close menu
    toggleSettingsMenu();
    console.log('✅ Settings saved!');
}

// Current open panel type
let currentSettingsPanel: string = '';

// Open full settings panel
function openSettingsPanel(panelType: string): void {
    const modal = document.getElementById('settings-modal');
    const title = document.getElementById('settings-modal-title');
    const content = document.getElementById('settings-modal-content');

    if (!modal || !title || !content) return;

    currentSettingsPanel = panelType;
    toggleSettingsMenu(); // Close dropdown

    // Set title and content based on panel type
    switch (panelType) {
        case 'general':
            title.innerHTML = '⚙️ General Settings';
            content.innerHTML = getGeneralSettingsContent();
            break;
        case 'overlays':
            title.innerHTML = '🖥️ Overlay URLs';
            content.innerHTML = getOverlayURLsContent();
            break;
        case 'sponsors':
            title.innerHTML = '🏷️ Sponsors';
            content.innerHTML = '<p class="text-gray-500">Coming Soon...</p>';
            break;
        default:
            return;
    }

    modal.classList.remove('hidden');
    loadPanelData(panelType);
}

function closeSettingsPanel(): void {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
    currentSettingsPanel = '';
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
        </div>
    `;
}

function loadPanelData(panelType: string): void {
    if (panelType === 'general') {
        const eventName = localStorage.getItem('esport-event-name') || '';
        const transitionColor = localStorage.getItem('esport-transition-color') || '#202224';
        const altColor = localStorage.getItem('esport-alt-color') || '#ffffff';

        setTimeout(() => {
            const eventInput = document.getElementById('event-name') as HTMLInputElement;
            const colorInput = document.getElementById('transition-color') as HTMLInputElement;
            const colorHex = document.getElementById('transition-color-hex');
            const altInput = document.getElementById('alt-color') as HTMLInputElement;
            const altHex = document.getElementById('alt-color-hex');

            if (eventInput) eventInput.value = eventName;
            if (colorInput) {
                colorInput.value = transitionColor;
                colorInput.addEventListener('input', () => {
                    if (colorHex) colorHex.textContent = colorInput.value;
                });
            }
            if (colorHex) colorHex.textContent = transitionColor;
            if (altInput) {
                altInput.value = altColor;
                altInput.addEventListener('input', () => {
                    if (altHex) altHex.textContent = altInput.value;
                });
            }
            if (altHex) altHex.textContent = altColor;
        }, 50);
    }
}

function saveCurrentSettings(): void {
    if (currentSettingsPanel === 'general') {
        saveGeneralSettings();
    }
    closeSettingsPanel();
}

function copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
        console.log('📋 Copied to clipboard:', text);
    });
}

// Load saved settings on init
function loadGeneralSettings(): void {
    // Settings are now loaded when panel opens
}

function updateSwapUI(swapped: boolean): void {
    const swapStatus = document.getElementById('swap-status');

    if (swapStatus) {
        swapStatus.textContent = swapped ? '🔀 สลับฝั่ง' : 'ปกติ';
    }

    // Re-render UI with new swap state
    if (currentState) {
        currentState.swapped = swapped;
        renderUI();
    }
}

async function updatePlayer(side: 'A' | 'B', slot: number, name: string): Promise<void> {
    const success = await postAPI('/api/player/update', {
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

async function handleLogoSelect(side: 'A' | 'B', input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('File too large! Maximum size is 2MB.');
        input.value = '';
        return;
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type! Allowed: PNG, JPG, WEBP, SVG, GIF');
        input.value = '';
        return;
    }

    // Upload logo
    await uploadLogo(side, file);
    input.value = '';
}

async function uploadLogo(side: 'A' | 'B', file: File): Promise<void> {
    const formData = new FormData();
    formData.append('logo', file);
    formData.append('side', side);

    try {
        const response = await fetch(`${API_BASE}/api/logo/upload`, {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            console.log(`✅ Logo for Team ${side} uploaded successfully`);
        } else {
            const error = await response.text();
            console.error(`❌ Failed to upload logo: ${error}`);
            alert(`Upload failed: ${error}`);
        }
    } catch (err) {
        console.error('❌ Logo upload error:', err);
        alert('Failed to upload logo. Please try again.');
    }
}

// Color picker state
let activePickerSide: 'A' | 'B' | null = null;
let pickerOverlay: HTMLDivElement | null = null;

async function pickColor(side: 'A' | 'B'): Promise<void> {
    // Try EyeDropper API first (Chrome/Edge)
    if ('EyeDropper' in window) {
        try {
            // @ts-ignore - EyeDropper is not in TypeScript types yet
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            applyColor(side, result.sRGBHex);
            return;
        } catch (err) {
            console.log('Color picking cancelled');
            return;
        }
    }

    // Fallback: Open pixel picker modal for logo
    const logoPreview = side === 'A' ? elements.teamALogoPreview() : elements.teamBLogoPreview();
    const logoImg = logoPreview?.querySelector('img') as HTMLImageElement | null;

    if (!logoImg) {
        alert('กรุณาอัพโหลดโลโก้ก่อน แล้วจึงดูดสีจากโลโก้ได้\n\n(หรือใช้ Chrome/Edge สำหรับดูดสีจากทุกที่บนหน้าจอ)');
        return;
    }

    // Open pixel picker modal
    openPixelPickerModal(side, logoImg.src);
}

function openPixelPickerModal(side: 'A' | 'B', imageSrc: string): void {
    activePickerSide = side;

    // Create overlay
    pickerOverlay = document.createElement('div');
    pickerOverlay.id = 'pixel-picker-overlay';
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
    const header = document.createElement('div');
    header.style.cssText = `
        color: white;
        font-size: 18px;
        margin-bottom: 20px;
        text-align: center;
    `;
    header.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">🎨 คลิกเลือกสีจากโลโก้ Team ${side}</div>
        <div style="font-size: 14px; color: #888;">กด ESC หรือคลิกนอกภาพเพื่อยกเลิก</div>
    `;

    // Create color preview
    const colorPreview = document.createElement('div');
    colorPreview.id = 'picker-color-preview';
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
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        border: 3px solid #3b82f6;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 0 50px rgba(59, 130, 246, 0.3);
    `;

    // Create canvas for pixel picking
    const canvas = document.createElement('canvas');
    canvas.id = 'picker-canvas';
    canvas.style.cssText = `
        max-width: 400px;
        max-height: 400px;
        cursor: crosshair;
        image-rendering: pixelated;
    `;

    // Load image to canvas
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const size = Math.min(400, Math.max(img.width, img.height, 200));
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // Draw image centered
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (size - w) / 2;
        const y = (size - h) / 2;

        ctx.fillStyle = '#374151';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, x, y, w, h);
    };
    img.src = imageSrc;

    // Mouse move - show color preview
    canvas.addEventListener('mousemove', (e) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

        const colorBox = document.getElementById('picker-color-box');
        const colorHex = document.getElementById('picker-color-hex');
        if (colorBox) colorBox.style.background = hex;
        if (colorHex) colorHex.textContent = hex;
    });

    // Click - select color
    canvas.addEventListener('click', (e) => {
        const ctx = canvas.getContext('2d');
        if (!ctx || !activePickerSide) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

        applyColor(activePickerSide, hex);
        closePixelPickerModal();
    });

    // Click outside to close
    pickerOverlay.addEventListener('click', (e) => {
        if (e.target === pickerOverlay) {
            closePixelPickerModal();
        }
    });

    // ESC to close
    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            closePixelPickerModal();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);

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
}

function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function applyColor(side: 'A' | 'B', color: string): void {
    const colorInput = side === 'A' ? elements.teamAColor() : elements.teamBColor();
    const colorHex = side === 'A' ? elements.teamAColorHex() : elements.teamBColorHex();

    if (colorInput) {
        colorInput.value = color;
        colorInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (colorHex) {
        colorHex.textContent = color;
    }

    console.log(`🎨 Picked color for Team ${side}: ${color}`);
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
        pickColor: typeof pickColor;
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
    }
}

window.saveTeam = saveTeam;
window.adjustScore = adjustScore;
window.updatePlayer = updatePlayer;
window.handleLogoSelect = handleLogoSelect;
window.pickColor = pickColor;
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

// ROV Heroes list (125 heroes) - Sorted A-Z
const HEROES = [
    "Airi", "Aleister", "Alice", "Allain", "Amily", "Annette", "Aoi", "Arduin", "Arum", "Astrid",
    "Ata", "Aya", "Azzen'Ka", "Baldum", "Batman", "Bijan", "Billow", "Biron", "Bolt Baron", "Bonnie",
    "Bright", "Butterfly", "Capheny", "Celica", "Charlotte", "Chaugnar", "Cresht", "D'Arcy", "Dextra", "Diao Chan",
    "Dirak", "Dolia", "Edras", "Eland'orr", "Elsu", "Enzo", "Erin", "Errol", "Fennik", "Florentino",
    "Gildur", "Goverra", "Grakk", "Hayate", "Heino", "Iggy", "Ignis", "Ilumia", "Ishar", "Jinna",
    "Kahlii", "Keera", "Kil'Groth", "Kriknak", "Krixi", "Krizzix", "Lauriel", "Laville", "Liliana", "Lindis",
    "Lorion", "Lu Bu", "Lumburr", "Maloch", "Marja", "Max", "Mganga", "Mina", "Ming", "Moren",
    "Mortos", "Murad", "Nakroth", "Natalya", "Omega", "Omen", "Ormarr", "Paine", "Payna", "Preyta",
    "Qi", "Quillen", "Raz", "Riktor", "Rouie", "Rourke", "Roxie", "Ryoma", "Sephera", "Sinestrea",
    "Skud", "Slimz", "Superman", "Taara", "Tachi", "TeeMee", "Teeri", "Tel'Annas", "Thane", "The Flash",
    "The Joker", "Thorne", "Toro", "Tulen", "Valhein", "Veera", "Veres", "Violet", "Volkath", "Wisp",
    "Wiro", "Wonder Woman", "WuKong", "Xeniel", "Y'bneth", "Yan", "Yena", "Yorn", "Yue", "Zanis",
    "Zata", "Zephys", "Zill", "Zip", "Zuka"
];

let heroPickerOverlay: HTMLDivElement | null = null;
let heroPickerSide: 'A' | 'B' | null = null;
let heroPickerSlot: number | null = null;

function openHeroPicker(side: 'A' | 'B', slot: number): void {
    heroPickerSide = side;
    heroPickerSlot = slot;

    // Create overlay
    heroPickerOverlay = document.createElement('div');
    heroPickerOverlay.id = 'hero-picker-overlay';
    heroPickerOverlay.style.cssText = `
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
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #1f2937;
        border-radius: 16px;
        padding: 24px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 0 50px rgba(59, 130, 246, 0.3);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        color: white;
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 16px;
        text-align: center;
    `;
    header.innerHTML = `🎮 Select Hero for Team ${side} - Player ${slot}`;

    // Search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '🔍 Search hero...';
    searchInput.style.cssText = `
        width: 100%;
        padding: 12px 16px;
        background: #111827;
        border: 2px solid #374151;
        border-radius: 8px;
        color: white;
        font-size: 16px;
        margin-bottom: 16px;
        outline: none;
    `;
    searchInput.addEventListener('focus', () => {
        searchInput.style.borderColor = '#3b82f6';
    });
    searchInput.addEventListener('blur', () => {
        searchInput.style.borderColor = '#374151';
    });

    // Hero grid container
    const gridContainer = document.createElement('div');
    gridContainer.id = 'hero-grid';
    gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 8px;
        overflow-y: auto;
        max-height: 400px;
        padding: 4px;
    `;

    // Render heroes
    const renderHeroes = (filter: string = '') => {
        const filteredHeroes = filter
            ? HEROES.filter(h => h.toLowerCase().startsWith(filter.toLowerCase()))
            : HEROES;

        gridContainer.innerHTML = filteredHeroes.map(hero => `
            <button 
                onclick="selectHero('${escapeHtml(hero)}')"
                class="hero-btn"
                style="
                    padding: 10px 8px;
                    background: #374151;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                "
                onmouseover="this.style.background='#4b5563'; this.style.transform='scale(1.05)';"
                onmouseout="this.style.background='#374151'; this.style.transform='scale(1)';"
            >
                ${escapeHtml(hero)}
            </button>
        `).join('');

        if (filteredHeroes.length === 0) {
            gridContainer.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 20px;">No heroes found</div>';
        }
    };

    renderHeroes();

    // Search input event
    searchInput.addEventListener('input', (e) => {
        renderHeroes((e.target as HTMLInputElement).value);
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close';
    closeBtn.style.cssText = `
        margin-top: 16px;
        padding: 10px 20px;
        background: #ef4444;
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        cursor: pointer;
    `;
    closeBtn.onclick = closeHeroPicker;

    // Click outside to close
    heroPickerOverlay.addEventListener('click', (e) => {
        if (e.target === heroPickerOverlay) {
            closeHeroPicker();
        }
    });

    // ESC to close
    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeHeroPicker();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(searchInput);
    modal.appendChild(gridContainer);
    modal.appendChild(closeBtn);
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

    const success = await postAPI('/api/player/update', {
        side: heroPickerSide,
        slot: heroPickerSlot,
        hero: heroName,
    });

    if (success) {
        console.log(`✅ Hero ${heroName} selected for Team ${heroPickerSide} Player ${heroPickerSlot}`);
    } else {
        console.error('❌ Failed to update hero');
    }

    closeHeroPicker();
}

// Expose selectHero to window for onclick
(window as any).selectHero = selectHero;

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
let loadedTemplateId: { A: string | null; B: string | null } = { A: null, B: null };

async function fetchTemplates(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/api/templates`);
        if (response.ok) {
            templates = await response.json();
            renderTemplateDropdowns();
        }
    } catch (err) {
        console.error('❌ Failed to fetch templates:', err);
    }
}

function renderTemplateDropdowns(): void {
    const teamASelect = document.getElementById('teamA-template') as HTMLSelectElement;
    const teamBSelect = document.getElementById('teamB-template') as HTMLSelectElement;

    const optionsHtml = templates.map(t =>
        `<option value="${t.id}">${escapeHtml(t.name)}</option>`
    ).join('');

    const defaultOption = '<option value="">📋 Select Template...</option>';

    if (teamASelect) teamASelect.innerHTML = defaultOption + optionsHtml;
    if (teamBSelect) teamBSelect.innerHTML = defaultOption + optionsHtml;
}

async function loadTemplate(side: 'A' | 'B'): Promise<void> {
    const selectId = `team${side}-template`;
    const select = document.getElementById(selectId) as HTMLSelectElement;
    const templateId = select?.value;

    if (!templateId) {
        alert('กรุณาเลือก Template ก่อน');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/templates/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId, side })
        });

        if (response.ok) {
            loadedTemplateId[side] = templateId; // Track which template is loaded
            console.log(`✅ Template loaded to Team ${side} (ID: ${templateId})`);
        } else {
            alert('Failed to load template');
        }
    } catch (err) {
        console.error('❌ Load template error:', err);
    }
}

async function saveAsTemplate(side: 'A' | 'B'): Promise<void> {
    if (!currentState) return;

    const team = currentState.teams[side];
    const templateName = prompt('Enter template name:', team.name);

    if (!templateName) return;

    const templateData = {
        name: templateName,
        color: team.color,
        logo: team.logo,
        players: team.players.map(p => ({ slot: p.slot, name: p.name }))
    };

    try {
        const response = await fetch(`${API_BASE}/api/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(templateData)
        });

        if (response.ok) {
            console.log(`✅ Template "${templateName}" saved`);
            alert(`Template "${templateName}" saved!`);
            fetchTemplates(); // Refresh dropdown
        } else {
            alert('Failed to save template');
        }
    } catch (err) {
        console.error('❌ Save template error:', err);
    }
}

async function syncTemplateAfterUpdate(side: 'A' | 'B'): Promise<void> {
    const templateId = loadedTemplateId[side];
    if (!templateId || !currentState) {
        return; // No template loaded for this side
    }

    const team = currentState.teams[side];

    try {
        const response = await fetch(`${API_BASE}/api/templates/${templateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: team.name,
                color: team.color,
                logo: team.logo,
                players: team.players.map(p => ({ slot: p.slot, name: p.name }))
            })
        });

        if (response.ok) {
            console.log(`🔄 Template ${templateId} synced with Team ${side} changes`);
            await fetchTemplates(); // Refresh templates cache
        }
    } catch (err) {
        console.error('❌ Template sync error:', err);
    }
}
// ==========================================
// Template Manager Modal
// ==========================================

let templateManagerOverlay: HTMLDivElement | null = null;
let templateLogoFile: File | null = null;
let editingTemplateId: string | null = null;

function openTemplateManager(): void {
    templateManagerOverlay = document.createElement('div');
    templateManagerOverlay.id = 'template-manager-overlay';
    templateManagerOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #1f2937;
        border-radius: 16px;
        padding: 24px;
        max-width: 800px;
        width: 95%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 0 60px rgba(139, 92, 246, 0.3);
        overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid #374151;
    `;
    header.innerHTML = `
        <h2 style="color: white; font-size: 22px; font-weight: bold;">📋 Template Manager</h2>
        <button id="close-template-manager" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold;">✕ Close</button>
    `;

    // Content container
    const content = document.createElement('div');
    content.style.cssText = `
        display: flex;
        gap: 20px;
        flex: 1;
        overflow: hidden;
    `;

    // Left: Create New Template Form
    const createSection = document.createElement('div');
    createSection.style.cssText = `
        flex: 1;
        background: #111827;
        border-radius: 12px;
        padding: 16px;
        overflow-y: auto;
    `;
    createSection.innerHTML = `
        <h3 style="color: #a855f7; font-weight: bold; margin-bottom: 12px;">➕ Create New Template</h3>
        <div style="margin-bottom: 12px;">
            <label style="color: #9ca3af; font-size: 12px; display: block; margin-bottom: 4px;">TEAM NAME *</label>
            <input type="text" id="tpl-name" placeholder="e.g. T1, LOUD, Gen.G" style="width: 100%; padding: 10px; background: #1f2937; border: 1px solid #374151; border-radius: 8px; color: white;">
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 12px;">
            <div style="flex: 1;">
                <label style="color: #9ca3af; font-size: 12px; display: block; margin-bottom: 4px;">COLOR</label>
                <input type="color" id="tpl-color" value="#3b82f6" style="width: 100%; height: 40px; border: none; border-radius: 8px; cursor: pointer;">
            </div>
            <div style="flex: 2;">
                <label style="color: #9ca3af; font-size: 12px; display: block; margin-bottom: 4px;">COLOR CODE</label>
                <input type="text" id="tpl-color-text" value="#3b82f6" style="width: 100%; padding: 10px; background: #1f2937; border: 1px solid #374151; border-radius: 8px; color: white; font-family: monospace;">
            </div>
        </div>
        <div style="margin-bottom: 12px;">
            <label style="color: #9ca3af; font-size: 12px; display: block; margin-bottom: 4px;">LOGO</label>
            <div style="display: flex; align-items: center; gap: 10px;">
                <div id="tpl-logo-preview" style="width: 48px; height: 48px; background: #1f2937; border-radius: 8px; border: 1px dashed #374151; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <span style="color: #6b7280; font-size: 10px;">No Logo</span>
                </div>
                <div style="flex: 1;">
                    <input type="file" id="tpl-logo-input" accept="image/*" style="display: none;" onchange="handleTemplateLogoSelect(this)">
                    <button type="button" onclick="document.getElementById('tpl-logo-input').click()" style="width: 100%; padding: 8px; background: #374151; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        📁 Choose Logo
                    </button>
                </div>
            </div>
        </div>
        <div style="margin-bottom: 12px;">
            <label style="color: #9ca3af; font-size: 12px; display: block; margin-bottom: 4px;">PLAYERS</label>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <input type="text" id="tpl-p1" placeholder="Player 1" style="width: 100%; padding: 8px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; color: white; font-size: 13px;">
                <input type="text" id="tpl-p2" placeholder="Player 2" style="width: 100%; padding: 8px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; color: white; font-size: 13px;">
                <input type="text" id="tpl-p3" placeholder="Player 3" style="width: 100%; padding: 8px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; color: white; font-size: 13px;">
                <input type="text" id="tpl-p4" placeholder="Player 4" style="width: 100%; padding: 8px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; color: white; font-size: 13px;">
                <input type="text" id="tpl-p5" placeholder="Player 5" style="width: 100%; padding: 8px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; color: white; font-size: 13px;">
            </div>
        </div>
        <button id="create-template-btn" style="width: 100%; padding: 12px; background: #a855f7; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px;">
            💾 Create Template
        </button>
    `;

    // Right: Template List
    const listSection = document.createElement('div');
    listSection.style.cssText = `
        flex: 1;
        background: #111827;
        border-radius: 12px;
        padding: 16px;
        overflow-y: auto;
    `;
    listSection.innerHTML = `
        <h3 style="color: #10b981; font-weight: bold; margin-bottom: 12px;">📂 Saved Templates (${templates.length})</h3>
        <div id="template-list" style="display: flex; flex-direction: column; gap: 8px;">
            ${templates.length === 0 ? '<p style="color: #6b7280; text-align: center; padding: 20px;">No templates yet</p>' :
            templates.map(t => `
                <div style="background: #1f2937; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer;" onclick="loadTemplateToForm('${t.id}')">
                        <div style="width: 16px; height: 16px; border-radius: 4px; background: ${t.color};"></div>
                        <div>
                            <div style="color: white; font-weight: bold;">${escapeHtml(t.name)}</div>
                            <div style="color: #6b7280; font-size: 11px;">${t.players?.length || 0} players</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="event.stopPropagation(); loadTemplateToForm('${t.id}')" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">✏️ Edit</button>
                        <button onclick="event.stopPropagation(); deleteTemplate('${t.id}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">🗑️</button>
                    </div>
                </div>
            `).join('')}
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
    document.getElementById('close-template-manager')!.onclick = closeTemplateManager;
    templateManagerOverlay.onclick = (e) => {
        if (e.target === templateManagerOverlay) closeTemplateManager();
    };

    // Color sync
    const colorInput = document.getElementById('tpl-color') as HTMLInputElement;
    const colorText = document.getElementById('tpl-color-text') as HTMLInputElement;
    colorInput.oninput = () => { colorText.value = colorInput.value; };
    colorText.oninput = () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(colorText.value)) {
            colorInput.value = colorText.value;
        }
    };

    // Create button
    document.getElementById('create-template-btn')!.onclick = createTemplateFromForm;
}

function closeTemplateManager(): void {
    if (templateManagerOverlay) {
        templateManagerOverlay.remove();
        templateManagerOverlay = null;
    }
}

async function createTemplateFromForm(): Promise<void> {
    const name = (document.getElementById('tpl-name') as HTMLInputElement).value.trim();
    const color = (document.getElementById('tpl-color') as HTMLInputElement).value;
    const players = [1, 2, 3, 4, 5].map(i => ({
        slot: i,
        name: (document.getElementById(`tpl-p${i}`) as HTMLInputElement).value.trim()
    })).filter(p => p.name);

    if (!name) {
        alert('กรุณาใส่ชื่อ Template');
        return;
    }

    try {
        let response;

        if (editingTemplateId) {
            // Update existing template
            response = await fetch(`${API_BASE}/api/templates/${editingTemplateId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color, logo: '', players })
            });
        } else {
            // Create new template
            response = await fetch(`${API_BASE}/api/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color, logo: '', players })
            });
        }

        if (response.ok) {
            const message = editingTemplateId ? 'updated' : 'created';
            alert(`✅ Template "${name}" ${message}!`);
            editingTemplateId = null; // Reset editing state
            await fetchTemplates();
            closeTemplateManager();
            openTemplateManager(); // Refresh list
        } else {
            alert('Failed to save template');
        }
    } catch (err) {
        console.error('Save template error:', err);
    }
}

function deleteTemplate(id: string): void {
    console.log('Delete clicked for:', id);

    const template = templates.find(t => t.id === id);
    const templateName = template?.name || 'this template';

    // Create custom confirmation modal
    const confirmOverlay = document.createElement('div');
    confirmOverlay.id = 'delete-confirm-overlay';
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
        <div style="background: #1f2937; border-radius: 12px; padding: 24px; max-width: 400px; text-align: center; box-shadow: 0 0 40px rgba(239, 68, 68, 0.3);">
            <h3 style="color: #ef4444; font-size: 18px; margin-bottom: 16px;">⚠️ ยืนยันการลบ</h3>
            <p style="color: white; margin-bottom: 8px;">คุณต้องการลบ Template</p>
            <p style="color: #a855f7; font-weight: bold; font-size: 16px; margin-bottom: 16px;">"${templateName}"</p>
            <p style="color: #6b7280; font-size: 12px; margin-bottom: 24px;">การลบจะไม่สามารถกู้คืนได้</p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="confirm-delete-yes" style="padding: 10px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">🗑️ ลบเลย</button>
                <button id="confirm-delete-no" style="padding: 10px 24px; background: #374151; color: white; border: none; border-radius: 8px; cursor: pointer;">ยกเลิก</button>
            </div>
        </div>
    `;

    document.body.appendChild(confirmOverlay);

    // Handle confirmation
    document.getElementById('confirm-delete-yes')!.onclick = async () => {
        confirmOverlay.remove();

        try {
            console.log(`Deleting template: ${id}`);
            const response = await fetch(`${API_BASE}/api/templates/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                await fetchTemplates();
                closeTemplateManager();
                openTemplateManager();
            } else {
                alert('❌ ไม่สามารถลบได้');
            }
        } catch (err) {
            console.error('Delete template error:', err);
        }
    };

    document.getElementById('confirm-delete-no')!.onclick = () => {
        confirmOverlay.remove();
    };

    confirmOverlay.onclick = (e) => {
        if (e.target === confirmOverlay) {
            confirmOverlay.remove();
        }
    };
}

function loadTemplateToForm(id: string): void {
    const template = templates.find(t => t.id === id);
    if (!template) return;

    editingTemplateId = id;

    // Populate form fields
    const nameInput = document.getElementById('tpl-name') as HTMLInputElement;
    const colorInput = document.getElementById('tpl-color') as HTMLInputElement;
    const colorText = document.getElementById('tpl-color-text') as HTMLInputElement;

    if (nameInput) nameInput.value = template.name;
    if (colorInput) colorInput.value = template.color;
    if (colorText) colorText.value = template.color;

    // Populate players
    for (let i = 1; i <= 5; i++) {
        const playerInput = document.getElementById(`tpl-p${i}`) as HTMLInputElement;
        const player = template.players?.find(p => p.slot === i);
        if (playerInput) {
            playerInput.value = player?.name || '';
        }
    }

    // Update button text to show "Update" instead of "Create"
    const createBtn = document.getElementById('create-template-btn');
    if (createBtn) {
        createBtn.innerHTML = '✏️ Update Template';
        createBtn.style.background = '#3b82f6';
    }

    // Scroll to form (visual feedback)
    const tplName = document.getElementById('tpl-name');
    tplName?.focus();
}

function handleTemplateLogoSelect(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;

    templateLogoFile = file;

    const preview = document.getElementById('tpl-logo-preview');
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
// Initialization
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Esport Control Panel Initializing...');

    // Fetch initial state via REST API
    fetchInitialState();

    // Fetch templates
    fetchTemplates();

    // Connect to WebSocket for real-time updates
    connectWebSocket();
});