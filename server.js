const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");

/* ========================== ENSURE DATA DIR ========================== */
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* ========================== MIME TYPES ========================== */
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".json": "application/json"
};

/* ========================== PERMISSIONS ========================== */
const Permissions = {
  fs: true,
  session: true,
  network: true
};

function requirePerm(res, perm) {
  if (!Permissions[perm]) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Permission denied", perm }));
    return false;
  }
  return true;
}

/* ========================== HELPERS ========================== */
function send(res, code, data, type = "application/json") {
  res.writeHead(code, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(data) : data);
}

function readBody(req) {
  return new Promise(resolve => {
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

/* ========================== API HANDLER ========================== */
async function handleAPI(req, res) {
  const parsed = url.parse(req.url, true);
  const endpoint = parsed.pathname.replace("/api/", "");

  /* ---- HEALTH ---- */
  if (endpoint === "ping") {
    return send(res, 200, {
      status: "ok",
      time: Date.now()
    });
  }

  /* ---- FILESYSTEM WRITE ---- */
  if (endpoint === "fs/write" && req.method === "POST") {
    if (!requirePerm(res, "fs")) return;
    const { path: p, data } = await readBody(req);
    if (!p) return send(res, 400, { error: "No path" });

    const full = path.join(DATA_DIR, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify(data, null, 2));

    return send(res, 200, { ok: true });
  }

  /* ---- FILESYSTEM READ ---- */
  if (endpoint === "fs/read" && req.method === "POST") {
    if (!requirePerm(res, "fs")) return;
    const { path: p } = await readBody(req);
    const full = path.join(DATA_DIR, p);
    if (!fs.existsSync(full)) return send(res, 404, { error: "Not found" });

    return send(res, 200, JSON.parse(fs.readFileSync(full)));
  }

  /* ---- SESSION SAVE ---- */
  if (endpoint === "session/save" && req.method === "POST") {
    if (!requirePerm(res, "session")) return;
    const body = await readBody(req);
    fs.writeFileSync(
      path.join(DATA_DIR, "session.json"),
      JSON.stringify(body, null, 2)
    );
    return send(res, 200, { ok: true });
  }

  /* ---- SESSION LOAD ---- */
  if (endpoint === "session/load") {
    if (!requirePerm(res, "session")) return;
    const f = path.join(DATA_DIR, "session.json");
    if (!fs.existsSync(f)) return send(res, 200, []);
    return send(res, 200, JSON.parse(fs.readFileSync(f)));
  }

  /* ---- UNKNOWN API ---- */
  send(res, 404, { error: "Unknown API endpoint" });
}

/* ========================== STATIC FILE SERVER ========================== */
function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end("404 Not Found");
  }
  const ext = path.extname(filePath);
  const type = TYPES[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end("Server Error");
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

/* ========================== SERVER ========================== */
http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    return handleAPI(req, res);
  }

  let file = req.url === "/" ? "/SE.html" : req.url;
  serveFile(res, path.join(ROOT, file));
}).listen(PORT, () => {
  console.log("HYPINEX CORE running on port", PORT);
});
