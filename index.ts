import { stateManager } from "./src/state";
import { lowerThirdManager } from "./src/lower-third-state";
import { bracketManager } from "./src/bracket-state";

const PORT = 3000;

const server = Bun.serve({
  port: PORT,
  // 1. WebSocket Setup (สำหรับ Overlay)
  websocket: {
    open(ws) {
      console.log("🔌 Client Connected via WebSocket");
      // พอ connect ปุ๊บ ส่ง state ล่าสุดไปให้ render ทันที
      ws.send(JSON.stringify({
        type: "STATE_UPDATE",
        data: stateManager.getState()
      }));
      // Subscribe เข้าห้องชื่อ "overlay" ไว้รอรับ update
      ws.subscribe("overlay");
    },
    message(ws, message) {
      // V1 ยังไม่ต้องรับ message จาก overlay (One-way communication)
    },
  },

  // 2. HTTP Request Handler
  async fetch(req, server) {
    const url = new URL(req.url);

    // --- WebSocket Upgrade ---
    if (server.upgrade(req)) {
      return; // Return if upgrade succeeded (WebSocket connection)
    }

    // --- CORS Headers (เผื่อรันแยก port) ---
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle Preflight Request
    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // --- API ENDPOINTS ---

    // GET /api/state - ดึงข้อมูลทั้งหมด
    if (url.pathname === "/api/state" && req.method === "GET") {
      return Response.json(stateManager.getState(), { headers });
    }

    // POST /api/team/update - แก้ข้อมูลทีม
    if (url.pathname === "/api/team/update" && req.method === "POST") {
      try {
        const body = await req.json();
        // body expect: { side: 'A' | 'B', ...data }
        const { side, ...data } = body;

        if (side !== 'A' && side !== 'B') {
          return new Response("Invalid side", { status: 400 });
        }

        // 1. Update Logic
        stateManager.updateTeam(side, data);

        // 2. Sync scores to linked bracket match (if exists)
        const linkedMatchId = stateManager.getLinkedMatch();
        if (linkedMatchId && (data.score !== undefined)) {
          const state = stateManager.getState();
          bracketManager.updateMatch(linkedMatchId, {
            scoreA: state.teams.A.score,
            scoreB: state.teams.B.score
          });

          // Broadcast bracket update
          const bracket = bracketManager.getState();
          server.publish("overlay", JSON.stringify({
            type: "BRACKET_UPDATE",
            data: bracket
          }));
          console.log(`📊 Score synced to bracket match: ${linkedMatchId}`);
        }

        // 3. Broadcast to Overlay (Real-time!)
        const newState = stateManager.getState();
        server.publish("overlay", JSON.stringify({
          type: "STATE_UPDATE",
          data: newState
        }));

        return Response.json({ success: true, state: newState }, { headers });
      } catch (err) {
        return new Response("Update failed", { status: 500 });
      }
    }

    // POST /api/player/update - แก้ผู้เล่นรายคน
    if (url.pathname === "/api/player/update" && req.method === "POST") {
      try {
        const body = await req.json();
        // body expect: { side: 'A' | 'B', slot: number, ...data }
        const { side, slot, ...data } = body;

        stateManager.updatePlayer(side, slot, data);

        // Broadcast
        const newState = stateManager.getState();
        server.publish("overlay", JSON.stringify({
          type: "STATE_UPDATE",
          data: newState
        }));

        return Response.json({ success: true }, { headers });
      } catch (err) {
        return new Response("Update Player failed", { status: 500 });
      }
    }

    // POST /api/match/link - Link/Unlink bracket match for score sync
    if (url.pathname === "/api/match/link" && req.method === "POST") {
      try {
        const body = await req.json();
        const { matchId } = body; // matchId can be string or null to unlink

        stateManager.setLinkedMatch(matchId || null);

        // Broadcast updated state
        const newState = stateManager.getState();
        server.publish("overlay", JSON.stringify({
          type: "STATE_UPDATE",
          data: newState
        }));

        return Response.json({
          success: true,
          linkedMatchId: matchId || null
        }, { headers });
      } catch (err) {
        return new Response("Link match failed", { status: 500 });
      }
    }

    // POST /api/swap - สลับฝั่งทีม
    if (url.pathname === "/api/swap" && req.method === "POST") {
      try {
        // Use stateManager to toggle swap state properly
        const newSwapped = stateManager.toggleSwap();
        const state = stateManager.getState();

        // Broadcast to overlay
        server.publish("overlay", JSON.stringify({
          type: "STATE_UPDATE",
          data: state
        }));

        console.log(`🔄 Swap toggled: ${newSwapped}`);
        return Response.json({ success: true, swapped: newSwapped }, { headers });
      } catch (err) {
        return new Response("Swap failed", { status: 500 });
      }
    }

    // POST /api/transition/trigger - Trigger transition animation
    if (url.pathname === "/api/transition/trigger" && req.method === "POST") {
      try {
        let config = {};
        try {
          config = await req.json();
        } catch (e) {
          // No config provided, use defaults
        }

        // Broadcast transition trigger to all overlay clients
        server.publish("overlay", JSON.stringify({
          type: "TRANSITION_TRIGGER",
          data: config
        }));

        console.log("🎬 Transition triggered");
        return Response.json({ success: true }, { headers });
      } catch (err) {
        return new Response("Transition trigger failed", { status: 500 });
      }
    }

    // POST /api/transition/logo - Upload transition logo
    if (url.pathname === "/api/transition/logo" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const logoFile = formData.get("logo") as File | null;

        if (!logoFile) {
          return new Response("No logo file provided", { status: 400 });
        }

        // Save logo to public/assets/transition-logo.png
        const logoPath = "./public/assets/transition-logo.png";
        const arrayBuffer = await logoFile.arrayBuffer();
        await Bun.write(logoPath, arrayBuffer);

        console.log("✅ Transition logo uploaded:", logoPath);
        return Response.json({ success: true, path: "/assets/transition-logo.png" }, { headers });
      } catch (err) {
        console.error("Logo upload error:", err);
        return new Response("Logo upload failed", { status: 500 });
      }
    }

    // GET /api/transition/logo - Get current transition logo path
    if (url.pathname === "/api/transition/logo" && req.method === "GET") {
      const logoPath = "./public/assets/transition-logo.png";
      const file = Bun.file(logoPath);
      const exists = await file.exists();

      if (exists) {
        return Response.json({ path: "/assets/transition-logo.png" }, { headers });
      } else {
        return Response.json({ path: null }, { headers });
      }
    }

    // ==========================================
    // Lower Third API Endpoints
    // ==========================================

    // GET /api/lower-third - Get current Lower Third state
    if (url.pathname === "/api/lower-third" && req.method === "GET") {
      return Response.json(lowerThirdManager.getState(), { headers });
    }

    // POST /api/lower-third - Update Lower Third settings
    if (url.pathname === "/api/lower-third" && req.method === "POST") {
      try {
        const data = await req.json();
        lowerThirdManager.updateState(data);

        // Broadcast to all overlay clients
        server.publish("overlay", JSON.stringify({
          type: "LOWER_THIRD_UPDATE",
          data: lowerThirdManager.getState()
        }));

        return Response.json({ success: true, state: lowerThirdManager.getState() }, { headers });
      } catch (err) {
        return new Response("Update failed", { status: 500 });
      }
    }

    // POST /api/lower-third/slot/:id/logo - Upload logo for specific slot
    if (url.pathname.startsWith("/api/lower-third/slot/") && url.pathname.endsWith("/logo") && req.method === "POST") {
      try {
        const pathParts = url.pathname.split('/');
        const slotId = parseInt(pathParts[4]);

        if (isNaN(slotId) || slotId < 1 || slotId > 3) {
          return new Response("Invalid slot ID", { status: 400 });
        }

        const formData = await req.formData();
        const logoFile = formData.get("logo") as File | null;

        if (!logoFile) {
          return new Response("No logo file provided", { status: 400 });
        }

        // Save logo to public/assets/lower-third-slot-{id}.png
        const logoPath = `./public/assets/lower-third-slot-${slotId}.png`;
        const arrayBuffer = await logoFile.arrayBuffer();
        await Bun.write(logoPath, arrayBuffer);

        // Update state
        lowerThirdManager.setSlotLogo(slotId, `/assets/lower-third-slot-${slotId}.png`);

        // Broadcast update
        server.publish("overlay", JSON.stringify({
          type: "LOWER_THIRD_UPDATE",
          data: lowerThirdManager.getState()
        }));

        console.log(`✅ Lower Third slot ${slotId} logo uploaded`);
        return Response.json({ success: true, path: `/assets/lower-third-slot-${slotId}.png` }, { headers });
      } catch (err) {
        console.error("Logo upload error:", err);
        return new Response("Logo upload failed", { status: 500 });
      }
    }

    // ==========================================
    // Bracket API Endpoints
    // ==========================================

    // GET /api/bracket - Get current bracket state
    if (url.pathname === "/api/bracket" && req.method === "GET") {
      return Response.json(bracketManager.getState(), { headers });
    }

    // POST /api/bracket/create - Create new bracket
    if (url.pathname === "/api/bracket/create" && req.method === "POST") {
      try {
        const body = await req.json();
        const { name, type, teams, teamData } = body;

        if (!name || !teams || !Array.isArray(teams) || teams.length < 2) {
          return new Response("Name and at least 2 teams required", { status: 400 });
        }

        const bracket = bracketManager.createBracket(name, type || 'single', teams, teamData);

        // Broadcast to overlay
        server.publish("overlay", JSON.stringify({
          type: "BRACKET_UPDATE",
          data: bracket
        }));

        console.log(`🏆 Bracket created: ${name} with ${teams.length} teams`);
        return Response.json({ success: true, bracket }, { headers });
      } catch (err) {
        console.error("Create bracket error:", err);
        return new Response("Create bracket failed", { status: 500 });
      }
    }

    // POST /api/bracket/match/update - Update match scores/winner
    if (url.pathname === "/api/bracket/match/update" && req.method === "POST") {
      try {
        const body = await req.json();
        const { matchId, scoreA, scoreB, winner } = body;

        if (!matchId) {
          return new Response("matchId required", { status: 400 });
        }

        const match = bracketManager.updateMatch(matchId, { scoreA, scoreB, winner });
        if (!match) {
          return new Response("Match not found", { status: 404 });
        }

        // Get full bracket state and broadcast
        const bracket = bracketManager.getState();
        server.publish("overlay", JSON.stringify({
          type: "BRACKET_UPDATE",
          data: bracket
        }));

        console.log(`📊 Match updated: ${matchId}`);
        return Response.json({ success: true, match, bracket }, { headers });
      } catch (err) {
        console.error("Update match error:", err);
        return new Response("Update match failed", { status: 500 });
      }
    }

    // POST /api/bracket/match/winner - Set match winner (simple click)
    if (url.pathname === "/api/bracket/match/winner" && req.method === "POST") {
      try {
        const body = await req.json();
        const { matchId, winner } = body;

        if (!matchId || !winner || (winner !== 'A' && winner !== 'B')) {
          return new Response("matchId and winner (A/B) required", { status: 400 });
        }

        const match = bracketManager.setMatchWinner(matchId, winner);
        if (!match) {
          return new Response("Match not found", { status: 404 });
        }

        // Broadcast
        const bracket = bracketManager.getState();
        server.publish("overlay", JSON.stringify({
          type: "BRACKET_UPDATE",
          data: bracket
        }));

        console.log(`🏆 Winner set: ${matchId} -> ${winner}`);
        return Response.json({ success: true, match, bracket }, { headers });
      } catch (err) {
        console.error("Set winner error:", err);
        return new Response("Set winner failed", { status: 500 });
      }
    }

    // POST /api/bracket/match/title - Update round title
    if (url.pathname === "/api/bracket/match/title" && req.method === "POST") {
      try {
        const body = await req.json();
        const { matchId, roundName } = body;

        if (!matchId || !roundName) {
          return new Response("matchId and roundName required", { status: 400 });
        }

        const match = bracketManager.updateRoundTitle(matchId, roundName);
        if (!match) {
          return new Response("Match not found", { status: 404 });
        }

        // Broadcast
        const bracket = bracketManager.getState();
        server.publish("overlay", JSON.stringify({
          type: "BRACKET_UPDATE",
          data: bracket
        }));

        return Response.json({ success: true, match }, { headers });
      } catch (err) {
        return new Response("Update title failed", { status: 500 });
      }
    }

    // DELETE /api/bracket - Reset bracket
    if (url.pathname === "/api/bracket" && req.method === "DELETE") {
      try {
        bracketManager.resetBracket();

        // Broadcast reset
        server.publish("overlay", JSON.stringify({
          type: "BRACKET_UPDATE",
          data: null
        }));

        console.log("🗑️ Bracket reset");
        return Response.json({ success: true }, { headers });
      } catch (err) {
        return new Response("Reset bracket failed", { status: 500 });
      }
    }

    // POST /api/bracket/shuffle - Shuffle teams in bracket (only if no scoring started)
    if (url.pathname === "/api/bracket/shuffle" && req.method === "POST") {
      try {
        const bracket = bracketManager.getState();

        if (!bracket || !bracket.matches || bracket.matches.length === 0) {
          return new Response("No bracket to shuffle", { status: 400 });
        }

        // Check if any scoring has started (any score > 0)
        const scoringStarted = bracket.matches.some((m: any) =>
          (m.scoreA && m.scoreA > 0) || (m.scoreB && m.scoreB > 0) || m.winner
        );

        if (scoringStarted) {
          return Response.json({
            success: false,
            locked: true,
            message: "Cannot shuffle after scoring has started"
          }, { status: 400, headers });
        }

        // Get all teams from round 1 matches
        const round1Matches = bracket.matches.filter((m: any) => m.round === 1);
        const teams: any[] = [];
        round1Matches.forEach((m: any) => {
          if (m.teamA && m.teamA.name !== 'BYE') teams.push(m.teamA);
          if (m.teamB && m.teamB.name !== 'BYE') teams.push(m.teamB);
        });

        // Fisher-Yates shuffle
        for (let i = teams.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [teams[i], teams[j]] = [teams[j], teams[i]];
        }

        // Recreate bracket with shuffled teams
        const newBracket = bracketManager.createBracket(
          bracket.name,
          bracket.type,
          teams.map(t => t.name),
          teams
        );

        // Broadcast update
        server.publish("overlay", JSON.stringify({
          type: "BRACKET_UPDATE",
          data: newBracket
        }));

        console.log("🔀 Bracket teams shuffled");
        return Response.json({ success: true, bracket: newBracket }, { headers });
      } catch (err) {
        console.error("Shuffle bracket error detail:", err);
        return new Response("Shuffle bracket failed", { status: 500 });
      }
    }

    // POST /api/logo/upload - อัพโหลดโลโก้ทีม
    if (url.pathname === "/api/logo/upload" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const logoFile = formData.get("logo") as File | null;
        const side = formData.get("side") as string;

        if (!logoFile || !side || (side !== "A" && side !== "B")) {
          return new Response("Invalid request: logo and side required", { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
        if (!allowedTypes.includes(logoFile.type)) {
          return new Response("Invalid file type. Allowed: PNG, JPG, WEBP, SVG, GIF", { status: 400 });
        }

        // Validate file size (max 2MB)
        const maxSize = 2 * 1024 * 1024;
        if (logoFile.size > maxSize) {
          return new Response("File too large. Max 2MB", { status: 400 });
        }

        // Get file extension
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const filename = `team-${side.toLowerCase()}.${ext}`;
        const filepath = `public/logos/${filename}`;

        // Save file
        const buffer = await logoFile.arrayBuffer();
        await Bun.write(filepath, buffer);

        // Update state with logo path and version
        const logoPath = `/logos/${filename}`;
        stateManager.updateTeam(side as "A" | "B", { logo: logoPath, logoVersion: Date.now() });

        // Broadcast
        const newState = stateManager.getState();
        server.publish("overlay", JSON.stringify({
          type: "STATE_UPDATE",
          data: newState
        }));

        return Response.json({ success: true, logoPath }, { headers });
      } catch (err) {
        console.error("Logo upload error:", err);
        return new Response("Logo upload failed", { status: 500 });
      }
    }

    // --- TEMPLATE API ---

    // GET /api/templates - List all templates
    if (url.pathname === "/api/templates" && req.method === "GET") {
      try {
        const file = Bun.file("data/templates.json");
        const templates = await file.exists() ? await file.json() : [];
        return Response.json(templates, { headers });
      } catch (err) {
        return Response.json([], { headers });
      }
    }

    // POST /api/templates - Save new template
    if (url.pathname === "/api/templates" && req.method === "POST") {
      try {
        const body = await req.json();
        const { name, color, logo, players } = body;

        if (!name) {
          return new Response("Template name required", { status: 400 });
        }

        const file = Bun.file("data/templates.json");
        const templates = await file.exists() ? await file.json() : [];

        const newTemplate = {
          id: `tpl_${Date.now()}`,
          name,
          color: color || "#3b82f6",
          logo: logo || "",
          players: players || [],
          createdAt: new Date().toISOString()
        };

        templates.push(newTemplate);
        await Bun.write("data/templates.json", JSON.stringify(templates, null, 2));

        // Broadcast template update to all clients
        server.publish("overlay", JSON.stringify({
          type: "TEMPLATES_UPDATE",
          data: templates
        }));

        console.log(`📁 Template created: ${name}`);
        return Response.json({ success: true, template: newTemplate }, { headers });
      } catch (err) {
        console.error("Save template error:", err);
        return new Response("Save template failed", { status: 500 });
      }
    }

    // DELETE /api/templates/:id - Delete template
    if (url.pathname.startsWith("/api/templates/") && url.pathname !== "/api/templates/apply" && req.method === "DELETE") {
      try {
        const id = url.pathname.split("/").pop();
        const file = Bun.file("data/templates.json");
        let templates = await file.exists() ? await file.json() : [];

        templates = templates.filter((t: any) => t.id !== id);
        await Bun.write("data/templates.json", JSON.stringify(templates, null, 2));

        // Broadcast template update to all clients
        server.publish("overlay", JSON.stringify({
          type: "TEMPLATES_UPDATE",
          data: templates
        }));

        console.log(`🗑️ Template deleted: ${id}`);
        return Response.json({ success: true }, { headers });
      } catch (err) {
        return new Response("Delete template failed", { status: 500 });
      }
    }

    // PUT /api/templates/:id - Update template
    if (url.pathname.startsWith("/api/templates/") && url.pathname !== "/api/templates/apply" && req.method === "PUT") {
      try {
        const id = url.pathname.split("/").pop();
        const body = await req.json();
        const { name, color, logo, players } = body;

        const file = Bun.file("data/templates.json");
        let templates = await file.exists() ? await file.json() : [];

        const index = templates.findIndex((t: any) => t.id === id);
        if (index === -1) {
          return new Response("Template not found", { status: 404 });
        }

        templates[index] = {
          ...templates[index],
          name: name || templates[index].name,
          color: color || templates[index].color,
          logo: logo !== undefined ? logo : templates[index].logo,
          players: players || templates[index].players,
          updatedAt: new Date().toISOString()
        };

        await Bun.write("data/templates.json", JSON.stringify(templates, null, 2));

        // Broadcast template update to all clients
        server.publish("overlay", JSON.stringify({
          type: "TEMPLATES_UPDATE",
          data: templates
        }));

        console.log(`📝 Template updated: ${templates[index].name}`);
        return Response.json({ success: true, template: templates[index] }, { headers });
      } catch (err) {
        console.error("Update template error:", err);
        return new Response("Update template failed", { status: 500 });
      }
    }

    // POST /api/templates/apply - Apply template to Team A or B
    if (url.pathname === "/api/templates/apply" && req.method === "POST") {
      try {
        const body = await req.json();
        const { templateId, side } = body;

        if (!templateId || !side || (side !== "A" && side !== "B")) {
          return new Response("templateId and side (A/B) required", { status: 400 });
        }

        const file = Bun.file("data/templates.json");
        const templates = await file.exists() ? await file.json() : [];
        const template = templates.find((t: any) => t.id === templateId);

        if (!template) {
          return new Response("Template not found", { status: 404 });
        }

        // Apply template to team
        stateManager.updateTeam(side, {
          name: template.name,
          color: template.color,
          logo: template.logo
        });

        // Apply players
        if (template.players && template.players.length > 0) {
          template.players.forEach((p: any) => {
            stateManager.updatePlayer(side, p.slot, { name: p.name });
          });
        }

        // Broadcast
        const newState = stateManager.getState();
        server.publish("overlay", JSON.stringify({
          type: "STATE_UPDATE",
          data: newState
        }));

        return Response.json({ success: true }, { headers });
      } catch (err) {
        console.error("Apply template error:", err);
        return new Response("Apply template failed", { status: 500 });
      }
    }

    // --- STATIC FILES ---

    // Serve index.html (Control Panel)
    if (url.pathname === "/") {
      return new Response(Bun.file("public/index.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Serve public folder (Overlay, Logo, etc.)
    const publicFile = Bun.file(`public${url.pathname}`);
    if (await publicFile.exists()) {
      return new Response(publicFile);
    }

    // Serve src folder (เผื่อ import js/css module)
    if (url.pathname.startsWith("/src/")) {
      console.log(`📂 Requesting source file: ${url.pathname}`);
      const srcFile = Bun.file(`.${url.pathname}`);
      if (await srcFile.exists()) {
        // Handle TypeScript files - transpile to JavaScript
        if (url.pathname.endsWith(".ts")) {
          const tsCode = await srcFile.text();
          const transpiler = new Bun.Transpiler({ loader: "ts" });
          const jsCode = transpiler.transformSync(tsCode);
          return new Response(jsCode, {
            headers: { "Content-Type": "text/javascript" }
          });
        }
        // Simple MIME type handling for JS/CSS
        const type = url.pathname.endsWith(".css") ? "text/css" :
          url.pathname.endsWith(".js") ? "text/javascript" : "text/plain";
        return new Response(srcFile, { headers: { "Content-Type": type } });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`✅ Esport Server running on http://localhost:${server.port}`);
console.log(`📡 WebSocket ready on ws://localhost:${server.port}`);