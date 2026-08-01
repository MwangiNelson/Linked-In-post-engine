// Zero-dependency local dev server.
// Lets you test without the Vercel CLI:  node dev-server.js  ->  http://localhost:3000
// It loads .env.local, serves /public, and routes POST /api/generate to the
// same handler Vercel uses in production.

const http = require("http");
const fs = require("fs");
const path = require("path");

// --- tiny .env.local loader (no dependency) ---
(function loadEnv() {
  const file = path.join(__dirname, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
})();

const API = {
  "/api/generate": require("./api/generate"),
  "/api/refine": require("./api/refine"),
};

const PORT = process.env.PORT || 3100;
const PUBLIC = path.join(__dirname, "public");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // API routes -> Vercel-style handlers. Add a .status()/.json() shim.
  const handler = API[url.pathname];
  if (handler) {
    shimRes(res);
    try {
      await handler(req, res);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
    return;
  }

  // Static files from /public
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  const full = path.join(PUBLIC, path.normalize(file).replace(/^(\.\.[/\\])+/, ""));
  if (full.startsWith(PUBLIC) && fs.existsSync(full) && fs.statSync(full).isFile()) {
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    fs.createReadStream(full).pipe(res);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

// Give the bare Node response the Express-like helpers our handler expects.
function shimRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(obj));
    return res;
  };
}

server.listen(PORT, () => {
  console.log(`\n  Local dev server: http://localhost:${PORT}`);
  console.log(`  Groq key:   ${process.env.GROQ_API_KEY ? "set" : "MISSING"}`);
  console.log(`  Gemini key: ${process.env.GEMINI_API_KEY ? "set" : "MISSING"}\n`);
});
