import { serve } from "bun";
import { join } from "path";

const PUBLIC_DIR = join(import.meta.dir, "../public");

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // API (เอาไว้ใช้ทีหลัง)
    if (url.pathname === "/api/status") {
      return Response.json({
        ok: true,
        status: "Server Connected"
      });
    }

    // Serve HTML
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const file = Bun.file(join(PUBLIC_DIR, "index.html"));
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("🟢 Esport Control Server running on http://localhost:3000");
