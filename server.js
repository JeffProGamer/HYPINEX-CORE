const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

/* ========================== MIME TYPES ========================== */
const MIME = {
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

/* ========================== HELPERS ========================== */
function send(res, code, data, type = "application/json") {
  res.writeHead(code, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(data) : data);
}

function readBody(req) {
  return new Promise(resolve => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

/* ========================== AI CORE (PLUG-IN READY) ========================== */
/*
  Replace these functions with:
  - OpenAI
  - Local LLM
  - Custom inference server
*/

const AI = {
  async chat(prompt) {
    return {
      type: "text",
      answer: `AI response placeholder.\nPrompt received:\n${prompt}`
    };
  },

  async script(prompt, language = "javascript") {
    return {
      type: "code",
      language,
      code: `// Generated ${language} script\n// Prompt: ${prompt}\n\nconsole.log("Hello from AI");`
    };
  },

  async image(prompt) {
    /* SFW ENFORCEMENT */
    const blocked = ["nsfw", "nude", "sex", "explicit"];
    if (blocked.some(w => prompt.toLowerCase().includes(w))) {
      return { error: "Prompt violates SFW policy" };
    }

    return {
      type: "image",
      note: "Image generation placeholder (SFW enforced)",
      prompt
    };
  },

  async explain(topic) {
    return {
      type: "explanation",
      structure: {
        summary: `Explanation for: ${topic}`,
        steps: [
          "Understand the problem",
          "Break it into parts",
          "Apply logic",
          "Deliver result"
        ]
      }
    };
  }
};

/* ========================== API ROUTER ========================== */
async function handleAPI(req, res) {
  const parsed = url.parse(req.url, true);
  const endpoint = parsed.pathname;

  /* ---- HEALTH ---- */
  if (endpoint === "/api/ping") {
    return send(res, 200, { status: "ok", time: Date.now() });
  }

  /* ---- AI CHAT ---- */
  if (endpoint === "/api/ai/chat" && req.method === "POST") {
    const { prompt } = await readBody(req);
    if (!prompt) return send(res, 400, { error: "Missing prompt" });
    return send(res, 200, await AI.chat(prompt));
  }

  /* ---- AI SCRIPTING ---- */
  if (endpoint === "/api/ai/script" && req.method === "POST") {
    const { prompt, language } = await readBody(req);
    if (!prompt) return send(res, 400, { error: "Missing prompt" });
    return send(res, 200, await AI.script(prompt, language));
  }

  /* ---- AI IMAGE (SFW) ---- */
  if (endpoint === "/api/ai/image" && req.method === "POST") {
    const { prompt } = await readBody(req);
    if (!prompt) return send(res, 400, { error: "Missing prompt" });
    return send(res, 200, await AI.image(prompt));
  }

  /* ---- AI EXPLAIN ---- */
  if (endpoint === "/api/ai/explain" && req.method === "POST") {
    const { topic } = await readBody(req);
    if (!topic) return send(res, 400, { error: "Missing topic" });
    return send(res, 200, await AI.explain(topic));
  }

  return send(res, 404, { error: "Unknown API endpoint" });
}

/* ========================== STATIC SERVER ========================== */
function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end("404 Not Found");
  }

  const ext = path.extname(filePath);
  const type = MIME[ext] || "application/octet-stream";

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

  const file = req.url === "/" ? "/SE.html" : req.url;
  serveFile(res, path.join(ROOT, file));
}).listen(PORT, () => {
  console.log("HYPINEX AI backend running on port", PORT);
});
