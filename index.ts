import { stateManager } from "./src/state";

import { obsManager } from "./src/obs-manager";
import { bracketManager } from "./src/bracket-state";
import { fontManager } from "./src/font-state";
import { showInfoManager } from "./src/show-info-state";
import { waitTimerManager } from "./src/wait-timer-state";
import { existsSync } from "fs";
import { join, dirname } from "path";

// Path Resolver for Tauri Sidecar
function resolvePath(relativePath: string): string {
  // 1. Check CWD (Dev mode)
  let path = join(process.cwd(), relativePath);
  if (existsSync(path)) return path;

  // 2. Check Resources (Prod mode)
  const potentialPaths = [
    join(process.cwd(), "resources", relativePath),
    join(process.cwd(), "..", "resources", relativePath),
    join(dirname(process.execPath), "resources", relativePath),
  ];

  for (const p of potentialPaths) {
    if (existsSync(p)) return p;
  }

  return relativePath; // Fallback
}

const port = process.env.PORT || 3000;

// DEBUG: Log startup paths
try {
  const debugPath = join(
    process.env.USERPROFILE || "C:\\Users\\Administrator",
    "Desktop",
    "server_debug.txt",
  );
  const debugInfo = `
Time: ${new Date().toISOString()}
CWD: ${process.cwd()}
ExecPath: ${process.execPath}
Dirs in CWD: ${JSON.stringify(require("fs").readdirSync(process.cwd()))}
resources path: ${join(process.cwd(), "resources")}
Files in resources: ${require("fs").existsSync(join(process.cwd(), "resources")) ? JSON.stringify(require("fs").readdirSync(join(process.cwd(), "resources"))) : "NOT FOUND"}
  `;
  require("fs").writeFileSync(debugPath, debugInfo);
} catch (e) {}

console.log(`Server running on port ${port}`);

const server = Bun.serve({
  port: port,
  // 1. WebSocket Setup (สำหรับ Overlay)
  websocket: {
    open(ws) {
      console.log("🔌 Client Connected");
      ws.send(
        JSON.stringify({
          type: "STATE_UPDATE",
          data: stateManager.getState(),
        }),
      );
      ws.subscribe("overlay");
    },
    message(ws, message) {},
  },

  // 2. HTTP Request Handler
  async fetch(req, server) {
    const url = new URL(req.url);

    if (server.upgrade(req)) {
      return;
    }

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (url.pathname === "/api/state" && req.method === "GET") {
      return Response.json(stateManager.getState(), { headers });
    }

    // POST /api/team/update - แก้ข้อมูลทีม
    if (url.pathname === "/api/team/update" && req.method === "POST") {
      try {
        const body = await req.json();
        const { side, ...data } = body;

        if (side !== "A" && side !== "B") {
          return new Response("Invalid side", { status: 400 });
        }

        stateManager.updateTeam(side, data);

        const linkedMatchId = stateManager.getLinkedMatch();
        if (linkedMatchId && data.score !== undefined) {
          const state = stateManager.getState();
          bracketManager.updateMatch(linkedMatchId, {
            scoreA: state.teams.A.score,
            scoreB: state.teams.B.score,
          });

          const bracket = bracketManager.getState();
          server.publish(
            "overlay",
            JSON.stringify({
              type: "BRACKET_UPDATE",
              data: bracket,
            }),
          );
        }

        const newState = stateManager.getState();
        server.publish(
          "overlay",
          JSON.stringify({
            type: "STATE_UPDATE",
            data: newState,
          }),
        );

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
        server.publish(
          "overlay",
          JSON.stringify({
            type: "STATE_UPDATE",
            data: newState,
          }),
        );

        return Response.json({ success: true }, { headers });
      } catch (err) {
        return new Response("Update Player failed", { status: 500 });
      }
    }

    // POST /api/match/update - อัปเดตข้อมูล Match (BestOf, BanCount)
    if (url.pathname === "/api/match/update" && req.method === "POST") {
      try {
        const body = await req.json();
        stateManager.updateMatch(body);

        // Broadcast
        const newState = stateManager.getState();
        server.publish(
          "overlay",
          JSON.stringify({
            type: "STATE_UPDATE",
            data: newState,
          }),
        );

        return Response.json({ success: true }, { headers });
      } catch (err) {
        return new Response("Update Match failed", { status: 500 });
      }
    }

    // POST /api/ban/update - อัปเดต Ban Hero
    if (url.pathname === "/api/ban/update" && req.method === "POST") {
      try {
        const body = await req.json();
        const { side, slot, hero } = body;

        if (!side || slot === undefined) {
          return new Response("Side and slot required", { status: 400 });
        }

        stateManager.updateBan(side, slot, hero);

        // Broadcast
        const newState = stateManager.getState();
        server.publish(
          "overlay",
          JSON.stringify({
            type: "STATE_UPDATE",
            data: newState,
          }),
        );

        return Response.json({ success: true }, { headers });
      } catch (err) {
        return new Response("Update Ban failed", { status: 500 });
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
        server.publish(
          "overlay",
          JSON.stringify({
            type: "STATE_UPDATE",
            data: newState,
          }),
        );

        return Response.json(
          {
            success: true,
            linkedMatchId: matchId || null,
          },
          { headers },
        );
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
        server.publish(
          "overlay",
          JSON.stringify({
            type: "STATE_UPDATE",
            data: state,
          }),
        );

        console.log(`🔄 Swap toggled: ${newSwapped}`);
        return Response.json(
          { success: true, swapped: newSwapped },
          { headers },
        );
      } catch (err) {
        return new Response("Swap failed", { status: 500 });
      }
    }

    // POST /api/reset-heroes - Reset all heroes, lanes and bans
    if (url.pathname === "/api/reset-heroes" && req.method === "POST") {
      try {
        stateManager.resetHeroes();
        const state = stateManager.getState();

        // Broadcast to overlay for real-time update
        server.publish(
          "overlay",
          JSON.stringify({
            type: "STATE_UPDATE",
            data: state,
          }),
        );

        console.log("🔄 Heroes reset via API");
        return Response.json(
          { success: true, message: "Heroes, lanes and bans reset" },
          { headers },
        );
      } catch (err) {
        return new Response("Reset heroes failed", { status: 500 });
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
        server.publish(
          "overlay",
          JSON.stringify({
            type: "TRANSITION_TRIGGER",
            data: config,
          }),
        );

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
        return Response.json(
          { success: true, path: "/assets/transition-logo.png" },
          { headers },
        );
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
        return Response.json(
          { path: "/assets/transition-logo.png" },
          { headers },
        );
      } else {
        return Response.json({ path: null }, { headers });
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
          return new Response("Name and at least 2 teams required", {
            status: 400,
          });
        }

        const bracket = bracketManager.createBracket(
          name,
          type || "single",
          teams,
          teamData,
        );

        // Broadcast to overlay
        server.publish(
          "overlay",
          JSON.stringify({
            type: "BRACKET_UPDATE",
            data: bracket,
          }),
        );

        console.log(`🏆 Bracket created: ${name} with ${teams.length} teams`);
        return Response.json({ success: true, bracket }, { headers });
      } catch (err: any) {
        console.error("Create bracket error:", err);
        const message = err?.message || "Create bracket failed";
        return Response.json(
          { success: false, message },
          { status: 400, headers },
        );
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

        const match = bracketManager.updateMatch(matchId, {
          scoreA,
          scoreB,
          winner,
        });
        if (!match) {
          return new Response("Match not found", { status: 404 });
        }

        // Get full bracket state and broadcast
        const bracket = bracketManager.getState();
        server.publish(
          "overlay",
          JSON.stringify({
            type: "BRACKET_UPDATE",
            data: bracket,
          }),
        );

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

        if (!matchId || !winner || (winner !== "A" && winner !== "B")) {
          return new Response("matchId and winner (A/B) required", {
            status: 400,
          });
        }

        const match = bracketManager.setMatchWinner(matchId, winner);
        if (!match) {
          return new Response("Match not found", { status: 404 });
        }

        // Broadcast
        const bracket = bracketManager.getState();
        server.publish(
          "overlay",
          JSON.stringify({
            type: "BRACKET_UPDATE",
            data: bracket,
          }),
        );

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
          return new Response("matchId and roundName required", {
            status: 400,
          });
        }

        const match = bracketManager.updateRoundTitle(matchId, roundName);
        if (!match) {
          return new Response("Match not found", { status: 404 });
        }

        // Broadcast
        const bracket = bracketManager.getState();
        server.publish(
          "overlay",
          JSON.stringify({
            type: "BRACKET_UPDATE",
            data: bracket,
          }),
        );

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
        server.publish(
          "overlay",
          JSON.stringify({
            type: "BRACKET_UPDATE",
            data: null,
          }),
        );

        console.log("🗑️ Bracket reset");
        return Response.json({ success: true }, { headers });
      } catch (err) {
        return new Response("Reset bracket failed", { status: 500 });
      }
    }

    // POST /api/bracket/reset - Reset bracket (alias for frontend)
    if (url.pathname === "/api/bracket/reset" && req.method === "POST") {
      try {
        bracketManager.resetBracket();

        // Broadcast reset
        server.publish(
          "overlay",
          JSON.stringify({
            type: "BRACKET_UPDATE",
            data: null,
          }),
        );

        console.log("🗑️ Bracket reset via POST");
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

        // Check if any REAL scoring has started (ignore BYE matches)
        // BYE matches have auto-winner, but we still allow shuffle until a non-BYE match has winner
        const scoringStarted = bracket.matches.some(
          (m: any) =>
            (m.scoreA && m.scoreA > 0) ||
            (m.scoreB && m.scoreB > 0) ||
            (m.winner && !m.isBye), // Only lock if winner is set on a non-BYE match
        );

        if (scoringStarted) {
          return Response.json(
            {
              success: false,
              locked: true,
              message: "Cannot shuffle after scoring has started",
            },
            { status: 400, headers },
          );
        }

        // Get all teams from round 1 matches
        const round1Matches = bracket.matches.filter((m: any) => m.round === 1);
        const teams: any[] = [];
        round1Matches.forEach((m: any) => {
          if (m.teamA && m.teamA.name !== "BYE") teams.push(m.teamA);
          if (m.teamB && m.teamB.name !== "BYE") teams.push(m.teamB);
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
          teams.map((t) => t.name),
          teams,
        );

        // Broadcast update
        server.publish(
          "overlay",
          JSON.stringify({
            type: "BRACKET_UPDATE",
            data: newBracket,
          }),
        );

        console.log("🔀 Bracket teams shuffled");
        return Response.json(
          { success: true, bracket: newBracket },
          { headers },
        );
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
          return new Response("Invalid request: logo and side required", {
            status: 400,
          });
        }

        // Validate file type
        const allowedTypes = [
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/svg+xml",
          "image/gif",
        ];
        if (!allowedTypes.includes(logoFile.type)) {
          return new Response(
            "Invalid file type. Allowed: PNG, JPG, WEBP, SVG, GIF",
            { status: 400 },
          );
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
        stateManager.updateTeam(side as "A" | "B", {
          logo: logoPath,
          logoVersion: Date.now(),
        });

        // Broadcast
        const newState = stateManager.getState();
        server.publish(
          "overlay",
          JSON.stringify({
            type: "STATE_UPDATE",
            data: newState,
          }),
        );

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
        const templates = (await file.exists()) ? await file.json() : [];
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
        const templates = (await file.exists()) ? await file.json() : [];

        const newTemplate = {
          id: `tpl_${Date.now()}`,
          name,
          color: color || "#3b82f6",
          logo: logo || "",
          players: players || [],
          createdAt: new Date().toISOString(),
        };

        templates.push(newTemplate);
        await Bun.write(
          "data/templates.json",
          JSON.stringify(templates, null, 2),
        );

        // Broadcast template update to all clients
        server.publish(
          "overlay",
          JSON.stringify({
            type: "TEMPLATES_UPDATE",
            data: templates,
          }),
        );

        console.log(`📁 Template created: ${name}`);
        return Response.json(
          { success: true, template: newTemplate },
          { headers },
        );
      } catch (err) {
        console.error("Save template error:", err);
        return new Response("Save template failed", { status: 500 });
      }
    }

    // DELETE /api/templates/:id - Delete template
    if (
      url.pathname.startsWith("/api/templates/") &&
      url.pathname !== "/api/templates/apply" &&
      req.method === "DELETE"
    ) {
      try {
        const id = url.pathname.split("/").pop();
        const file = Bun.file("data/templates.json");
        let templates = (await file.exists()) ? await file.json() : [];

        templates = templates.filter((t: any) => t.id !== id);
        await Bun.write(
          "data/templates.json",
          JSON.stringify(templates, null, 2),
        );

        // Broadcast template update to all clients
        server.publish(
          "overlay",
          JSON.stringify({
            type: "TEMPLATES_UPDATE",
            data: templates,
          }),
        );

        console.log(`🗑️ Template deleted: ${id}`);
        return Response.json({ success: true }, { headers });
      } catch (err) {
        return new Response("Delete template failed", { status: 500 });
      }
    }

    // PUT /api/templates/:id - Update template
    if (
      url.pathname.startsWith("/api/templates/") &&
      url.pathname !== "/api/templates/apply" &&
      req.method === "PUT"
    ) {
      try {
        const id = url.pathname.split("/").pop();
        const body = await req.json();
        const { name, color, logo, players } = body;

        const file = Bun.file("data/templates.json");
        let templates = (await file.exists()) ? await file.json() : [];

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
          updatedAt: new Date().toISOString(),
        };

        await Bun.write(
          "data/templates.json",
          JSON.stringify(templates, null, 2),
        );

        // Broadcast template update to all clients
        server.publish(
          "overlay",
          JSON.stringify({
            type: "TEMPLATES_UPDATE",
            data: templates,
          }),
        );

        console.log(`📝 Template updated: ${templates[index].name}`);
        return Response.json(
          { success: true, template: templates[index] },
          { headers },
        );
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
          return new Response("templateId and side (A/B) required", {
            status: 400,
          });
        }

        const file = Bun.file("data/templates.json");
        const templates = (await file.exists()) ? await file.json() : [];
        const template = templates.find((t: any) => t.id === templateId);

        if (!template) {
          return new Response("Template not found", { status: 404 });
        }

        // Apply template to team
        stateManager.updateTeam(side, {
          name: template.name,
          color: template.color,
          logo: template.logo,
        });

        // Apply players
        if (template.players && template.players.length > 0) {
          template.players.forEach((p: any) => {
            stateManager.updatePlayer(side, p.slot, { name: p.name });
          });
        }

        // Broadcast
        const newState = stateManager.getState();
        server.publish(
          "overlay",
          JSON.stringify({
            type: "STATE_UPDATE",
            data: newState,
          }),
        );

        return Response.json({ success: true }, { headers });
      } catch (err) {
        console.error("Apply template error:", err);
        return new Response("Apply template failed", { status: 500 });
      }
    }

    // ==========================================
    // Font API Endpoints
    // ==========================================

    // GET /api/fonts - List all fonts
    if (url.pathname === "/api/fonts" && req.method === "GET") {
      // Rescan directory to pick up any new fonts
      fontManager.scanFontsDirectory();
      return Response.json(fontManager.getState(), { headers });
    }

    // GET /api/fonts/css - Get CSS for all custom fonts
    if (url.pathname === "/api/fonts/css" && req.method === "GET") {
      const css = fontManager.generateCSS();
      return new Response(css, {
        headers: {
          ...headers,
          "Content-Type": "text/css",
        },
      });
    }

    // POST /api/fonts/upload - Upload a new font
    if (url.pathname === "/api/fonts/upload" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const fontFile = formData.get("font") as File | null;
        const fontName = formData.get("name") as string | null;
        const fontWeight = formData.get("weight") as string | null;
        const fontStyle = formData.get("style") as string | null;

        if (!fontFile) {
          return new Response("No font file provided", { status: 400 });
        }

        // Validate file type
        const allowedExtensions = [".ttf", ".otf", ".woff", ".woff2"];
        const ext = fontFile.name
          .substring(fontFile.name.lastIndexOf("."))
          .toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          return new Response(
            "Invalid file type. Allowed: TTF, OTF, WOFF, WOFF2",
            { status: 400 },
          );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (fontFile.size > maxSize) {
          return new Response("File too large. Max 5MB", { status: 400 });
        }

        // Save file
        const filename = fontFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filepath = `public/fonts/custom/${filename}`;
        const buffer = await fontFile.arrayBuffer();
        await Bun.write(filepath, buffer);

        // Get format from extension
        const formatMap: Record<string, string> = {
          ".ttf": "truetype",
          ".otf": "opentype",
          ".woff": "woff",
          ".woff2": "woff2",
        };

        // Add to font manager
        const font = fontManager.addFont({
          name:
            fontName ||
            fontFile.name.substring(0, fontFile.name.lastIndexOf(".")),
          filename: filename,
          format: formatMap[ext] || "truetype",
          path: `/fonts/custom/${filename}`,
          weight: fontWeight || "400",
          style: fontStyle || "normal",
        });

        // Broadcast font update
        server.publish(
          "overlay",
          JSON.stringify({
            type: "FONT_UPDATE",
            data: fontManager.getState(),
          }),
        );

        console.log(`🔤 Font uploaded: ${font.name}`);
        return Response.json({ success: true, font }, { headers });
      } catch (err) {
        console.error("Font upload error:", err);
        return new Response("Font upload failed", { status: 500 });
      }
    }

    // PUT /api/fonts/:id - Update font info
    if (
      url.pathname.startsWith("/api/fonts/") &&
      !url.pathname.includes("/css") &&
      !url.pathname.includes("/upload") &&
      !url.pathname.includes("/settings") &&
      req.method === "PUT"
    ) {
      try {
        const id = url.pathname.split("/").pop();
        const body = await req.json();

        const font = fontManager.updateFont(id!, body);
        if (!font) {
          return new Response("Font not found", { status: 404 });
        }

        // Broadcast font update
        server.publish(
          "overlay",
          JSON.stringify({
            type: "FONT_UPDATE",
            data: fontManager.getState(),
          }),
        );

        console.log(`📝 Font updated: ${font.name}`);
        return Response.json({ success: true, font }, { headers });
      } catch (err) {
        console.error("Font update error:", err);
        return new Response("Font update failed", { status: 500 });
      }
    }

    // DELETE /api/fonts/:id - Delete a font
    if (
      url.pathname.startsWith("/api/fonts/") &&
      !url.pathname.includes("/css") &&
      !url.pathname.includes("/upload") &&
      !url.pathname.includes("/settings") &&
      req.method === "DELETE"
    ) {
      try {
        const id = url.pathname.split("/").pop();
        const font = fontManager.getFont(id!);

        if (!font) {
          return new Response("Font not found", { status: 404 });
        }

        // Delete file
        const filepath = `public${font.path}`;
        const file = Bun.file(filepath);
        if (await file.exists()) {
          await Bun.write(filepath, ""); // Clear file
          // Note: Bun doesn't have direct unlink, but we can leave empty file
          // or use node:fs
          const { unlinkSync } = await import("fs");
          unlinkSync(filepath);
        }

        fontManager.deleteFont(id!);

        // Broadcast font update
        server.publish(
          "overlay",
          JSON.stringify({
            type: "FONT_UPDATE",
            data: fontManager.getState(),
          }),
        );

        console.log(`🗑️ Font deleted: ${font.name}`);
        return Response.json({ success: true }, { headers });
      } catch (err) {
        console.error("Font delete error:", err);
        return new Response("Font delete failed", { status: 500 });
      }
    }

    // GET /api/fonts/settings - Get font assignments
    if (url.pathname === "/api/fonts/settings" && req.method === "GET") {
      return Response.json(fontManager.getAssignments(), { headers });
    }

    // POST /api/fonts/settings - Update font assignments
    if (url.pathname === "/api/fonts/settings" && req.method === "POST") {
      try {
        const body = await req.json();
        const assignments = fontManager.updateAssignments(body);

        // Broadcast font update
        server.publish(
          "overlay",
          JSON.stringify({
            type: "FONT_UPDATE",
            data: fontManager.getState(),
          }),
        );

        console.log(`⚙️ Font assignments updated`);
        return Response.json({ success: true, assignments }, { headers });
      } catch (err) {
        console.error("Font settings update error:", err);
        return new Response("Font settings update failed", { status: 500 });
      }
    }

    // ==========================================
    // SHOW INFO API
    // ==========================================

    // GET /api/showinfo - Get current show info state
    if (url.pathname === "/api/showinfo" && req.method === "GET") {
      return Response.json(showInfoManager.getState(), { headers });
    }

    // POST /api/showinfo/update - Update show info
    if (url.pathname === "/api/showinfo/update" && req.method === "POST") {
      try {
        const body = await req.json();
        const state = showInfoManager.update(body);

        // Broadcast to overlays
        server.publish(
          "overlay",
          JSON.stringify({
            type: "SHOWINFO_UPDATE",
            data: state,
          }),
        );

        console.log(`📺 ShowInfo updated`);
        return Response.json({ success: true, state }, { headers });
      } catch (err) {
        console.error("ShowInfo update error:", err);
        return new Response("Update failed", { status: 500 });
      }
    }

    // POST /api/showinfo/logo - Upload logo (left or right)
    if (url.pathname === "/api/showinfo/logo" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const position = formData.get("position") as string; // "left" or "right"

        if (!file || !position) {
          return new Response("Missing file or position", { status: 400 });
        }

        const ext = file.name.split(".").pop() || "png";
        const filename = `showinfo-${position}-logo.${ext}`;
        const filePath = `public/uploads/${filename}`;

        await Bun.write(filePath, file);

        const logoUrl = `/uploads/${filename}?v=${Date.now()}`;

        // Update state based on position
        if (position === "left") {
          showInfoManager.update({ leftLogo: logoUrl });
        } else {
          showInfoManager.update({ rightLogo: logoUrl });
        }

        // Broadcast update
        server.publish(
          "overlay",
          JSON.stringify({
            type: "SHOWINFO_UPDATE",
            data: showInfoManager.getState(),
          }),
        );

        console.log(`📷 ShowInfo ${position} logo uploaded: ${filename}`);
        return Response.json({ success: true, path: logoUrl }, { headers });
      } catch (err) {
        console.error("Logo upload error:", err);
        return new Response("Upload failed", { status: 500 });
      }
    }

    // ==========================================
    // WAIT TIMER API
    // ==========================================

    // GET /api/wait-timer - Get current timer state
    if (url.pathname === "/api/wait-timer" && req.method === "GET") {
      return Response.json(waitTimerManager.getState(), { headers });
    }

    // POST /api/wait-timer/set - Set timer value (in seconds)
    if (url.pathname === "/api/wait-timer/set" && req.method === "POST") {
      try {
        const body = await req.json();
        const { seconds } = body;

        if (typeof seconds !== "number" || seconds < 0) {
          return new Response("Invalid seconds value", { status: 400 });
        }

        const state = waitTimerManager.setTimer(seconds);

        // Broadcast to overlays
        server.publish(
          "overlay",
          JSON.stringify({
            type: "WAIT_TIMER_UPDATE",
            data: {
              action: "set",
              seconds: state.seconds,
              running: state.running,
              endTime: state.endTime,
            },
          }),
        );

        console.log(`⏱️ Wait Timer set: ${seconds}s`);
        return Response.json({ success: true, state }, { headers });
      } catch (err) {
        console.error("Set timer error:", err);
        return new Response("Set timer failed", { status: 500 });
      }
    }

    // POST /api/wait-timer/start - Start the timer
    if (url.pathname === "/api/wait-timer/start" && req.method === "POST") {
      try {
        const state = waitTimerManager.startTimer();

        // Broadcast to overlays
        server.publish(
          "overlay",
          JSON.stringify({
            type: "WAIT_TIMER_UPDATE",
            data: {
              action: "start",
              seconds: state.seconds,
              running: state.running,
              endTime: state.endTime,
            },
          }),
        );

        console.log(`▶️ Wait Timer started`);
        return Response.json({ success: true, state }, { headers });
      } catch (err) {
        console.error("Start timer error:", err);
        return new Response("Start timer failed", { status: 500 });
      }
    }

    // POST /api/wait-timer/stop - Stop the timer
    if (url.pathname === "/api/wait-timer/stop" && req.method === "POST") {
      try {
        const state = waitTimerManager.stopTimer();

        // Broadcast to overlays
        server.publish(
          "overlay",
          JSON.stringify({
            type: "WAIT_TIMER_UPDATE",
            data: {
              action: "stop",
              seconds: state.seconds,
              running: state.running,
              endTime: state.endTime,
            },
          }),
        );

        console.log(`⏸️ Wait Timer stopped`);
        return Response.json({ success: true, state }, { headers });
      } catch (err) {
        console.error("Stop timer error:", err);
        return new Response("Stop timer failed", { status: 500 });
      }
    }

    // POST /api/wait-timer/reset - Reset the timer
    if (url.pathname === "/api/wait-timer/reset" && req.method === "POST") {
      try {
        const state = waitTimerManager.resetTimer();

        // Broadcast to overlays
        server.publish(
          "overlay",
          JSON.stringify({
            type: "WAIT_TIMER_UPDATE",
            data: {
              action: "reset",
              seconds: 0,
              running: false,
              endTime: null,
            },
          }),
        );

        console.log(`🔄 Wait Timer reset`);
        return Response.json({ success: true, state }, { headers });
      } catch (err) {
        console.error("Reset timer error:", err);
        return new Response("Reset timer failed", { status: 500 });
      }
    }

    // ==========================================
    // OBS API
    // ==========================================

    // POST /api/obs/connect
    if (url.pathname === "/api/obs/connect" && req.method === "POST") {
      try {
        const body = await req.json();
        const { address, password } = body;
        const success = await obsManager.connect(address, password);
        return Response.json({ success }, { headers });
      } catch (error) {
        console.error("OBS Connect Error:", error);
        return new Response("Failed to connect", { status: 500 });
      }
    }

    // POST /api/obs/disconnect
    if (url.pathname === "/api/obs/disconnect" && req.method === "POST") {
      await obsManager.disconnect();
      return Response.json({ success: true }, { headers });
    }

    // POST /api/obs/switch
    if (url.pathname === "/api/obs/switch" && req.method === "POST") {
      try {
        const body = await req.json();
        const { sceneName } = body;
        const success = await obsManager.switchScene(sceneName);
        return Response.json({ success }, { headers });
      } catch (error) {
        console.error("OBS Switch Error:", error);
        return new Response("Failed to switch scene", { status: 500 });
      }
    }

    // GET /api/obs/status
    if (url.pathname === "/api/obs/status" && req.method === "GET") {
      return Response.json(obsManager.getStatus(), { headers });
    }

    // GET /api/obs/scenes
    if (url.pathname === "/api/obs/scenes" && req.method === "GET") {
      const scenes = await obsManager.getScenes();
      return Response.json(scenes, { headers });
    }

    // POST /api/obs/apply-layout - Copy Esport__PaperX2.json to OBS scenes directory
    if (url.pathname === "/api/obs/apply-layout" && req.method === "POST") {
      try {
        const file = Bun.file("./obs/Esport__PaperX2.json");
        if (await file.exists()) {
          // Windows only: Copy to AppData
          if (process.platform === "win32" && process.env.APPDATA) {
            try {
              const obsScenesPath = `${process.env.APPDATA}\\obs-studio\\basic\\scenes`;
              // Use the exact filename to match manual import behavior expectation
              const destPath = `${obsScenesPath}\\Esport__PaperX2.json`;

              console.log(`📂 Copying layout to: ${destPath}`);
              await Bun.write(destPath, file);
              console.log("✅ Layout file imported to OBS");

              return Response.json(
                {
                  success: true,
                  message: "Imported to OBS. Please restart OBS.",
                },
                { headers },
              );
            } catch (copyErr) {
              console.error("Copy error:", copyErr);
              return new Response("Permission error copying to OBS", {
                status: 500,
              });
            }
          } else {
            return new Response("Auto-import only supported on Windows", {
              status: 400,
            });
          }
        } else {
          return new Response("Layout file not found", { status: 404 });
        }
      } catch (err) {
        console.error("Import layout error:", err);
        return new Response("Error importing layout", { status: 500 });
      }
    }

    // ==========================================
    // TRANSITION LOGO API
    // ==========================================

    // GET /api/transition/logo
    if (url.pathname === "/api/transition/logo" && req.method === "GET") {
      try {
        // Check for existing logo files
        const extensions = ["png", "jpg", "jpeg", "webp", "gif"];
        let logoPath = null;

        // Only check for transition-logo.*
        for (const ext of extensions) {
          const path = `public/uploads/transition-logo.${ext}`;
          const file = Bun.file(path);
          if (await file.exists()) {
            logoPath = `/uploads/transition-logo.${ext}`;
            break;
          }
        }

        return Response.json(
          {
            success: true,
            url: logoPath ? `${logoPath}?v=${Date.now()}` : null,
            path: logoPath ? `${logoPath}?v=${Date.now()}` : null,
          },
          { headers },
        );
      } catch (err) {
        return new Response("Error checking logo", { status: 500 });
      }
    }

    // POST /api/transition/logo
    if (url.pathname === "/api/transition/logo" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
          return new Response("No file uploaded", { status: 400 });
        }

        // Delete existing logos first to avoid confusion
        const extensions = ["png", "jpg", "jpeg", "webp", "gif"];
        const { unlinkSync, existsSync } = await import("fs"); // Use node:fs for synchronous delete

        for (const ext of extensions) {
          const p = `public/uploads/transition-logo.${ext}`;
          if (existsSync(p)) {
            try {
              unlinkSync(p);
            } catch (e) {}
          }
        }

        const ext = file.name.split(".").pop() || "png";
        const filename = `transition-logo.${ext}`;
        const filePath = `public/uploads/${filename}`;

        await Bun.write(filePath, file);

        const logoUrl = `/uploads/${filename}?v=${Date.now()}`;

        // Broadcast update to transition.html
        server.publish(
          "overlay",
          JSON.stringify({
            type: "TRANSITION_CONFIG",
            data: {
              logoUrl: logoUrl,
            },
          }),
        );

        return Response.json(
          {
            success: true,
            url: logoUrl,
            path: logoUrl,
          },
          { headers },
        );
      } catch (err) {
        console.error("Transition logo upload error:", err);
        return new Response("Upload failed", { status: 500 });
      }
    }

    // --- FONT MANAGEMENT ---

    // GET /api/fonts - List all fonts and assignments
    if (url.pathname === "/api/fonts" && req.method === "GET") {
      return Response.json(fontManager.getState(), { headers });
    }

    // POST /api/fonts - Upload new font
    if (url.pathname === "/api/fonts" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const fontFile = formData.get("font");

        if (!fontFile || !(fontFile instanceof File)) {
          return new Response("No font file provided", { status: 400 });
        }

        const name = fontFile.name;
        const id = crypto.randomUUID();
        // Determine extension
        const ext = name.split(".").pop()?.toLowerCase() || "ttf";
        const filename = `${id}-${name}`;
        const savePath = `public/fonts/custom/${filename}`;

        await Bun.write(savePath, fontFile);

        // Analyze font meta (simplified)
        const familyName = name.replace(/\.[^/.]+$/, "");

        const newFontData = {
          name: familyName,
          filename: filename,
          format:
            ext === "ttf" ? "truetype" : ext === "otf" ? "opentype" : "woff2",
          path: `/fonts/custom/${filename}`,
          weight: "normal",
          style: "normal",
        };

        const newState = fontManager.addFont(newFontData);

        // Broadcast update
        server.publish(
          "overlay",
          JSON.stringify({ type: "FONT_UPDATE", data: fontManager.getState() }),
        );

        return Response.json(
          { success: true, state: fontManager.getState() },
          { headers },
        );
      } catch (err) {
        console.error("Font upload error:", err);
        return new Response("Upload failed", { status: 500 });
      }
    }

    // POST /api/fonts/settings - Update assignments
    // GET /api/fonts - Get all font settings (fonts + assignments)
    if (url.pathname === "/api/fonts" && req.method === "GET") {
      return Response.json(fontManager.getState(), { headers });
    }

    // GET /api/fonts/assignments - Get just assignments
    if (url.pathname === "/api/fonts/assignments" && req.method === "GET") {
      return Response.json(fontManager.getState().assignments, { headers });
    }

    // POST /api/fonts/settings - Update assignments
    if (url.pathname === "/api/fonts/settings" && req.method === "POST") {
      try {
        const assignments = await req.json();
        const newState = fontManager.updateAssignments(assignments);

        // Broadcast update
        server.publish(
          "overlay",
          JSON.stringify({ type: "FONT_UPDATE", data: fontManager.getState() }),
        );

        return Response.json(
          { success: true, state: fontManager.getState() },
          { headers },
        );
      } catch (err) {
        return new Response("Update settings failed", { status: 500 });
      }
    }

    // DELETE /api/fonts/:id
    if (url.pathname.startsWith("/api/fonts/") && req.method === "DELETE") {
      const id = url.pathname.split("/").pop();
      if (id) {
        fontManager.deleteFont(id);
        const newState = fontManager.getState();
        server.publish(
          "overlay",
          JSON.stringify({ type: "FONT_UPDATE", data: newState }),
        );
        return Response.json({ success: true }, { headers });
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
    const publicPath = resolvePath(`public${url.pathname}`);
    const publicFile = Bun.file(publicPath);
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
            headers: { "Content-Type": "text/javascript" },
          });
        }
        // Simple MIME type handling for JS/CSS
        const type = url.pathname.endsWith(".css")
          ? "text/css"
          : url.pathname.endsWith(".js")
            ? "text/javascript"
            : "text/plain";
        return new Response(srcFile, { headers: { "Content-Type": type } });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`✅ Esport Server running on http://localhost:${server.port}`);
console.log(`📡 WebSocket ready on ws://localhost:${server.port}`);
