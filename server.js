import http from "http";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import OpenAI from "openai";

const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/* ===========================
   STATIC SERVER
=========================== */
function serve(res, file, type = "text/html") {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404 Not Found");
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

/* ===========================
   MODERATION ENGINE
=========================== */
function moderatePrompt(prompt, mode) {
  const banned = [
    "nsfw", "sexual", "porn", "nude",
    "child", "minor", "illegal", "exploit"
  ];

  const lower = prompt.toLowerCase();
  for (const word of banned) {
    if (lower.includes(word)) {
      return {
        blocked: true,
        reason: `Disallowed content: ${word}`
      };
    }
  }

  if (mode === "image" && lower.includes("real person")) {
    return {
      blocked: true,
      reason: "Real-person image generation not allowed"
    };
  }

  return { blocked: false };
}

/* ===========================
   MODEL ROUTER
=========================== */
function resolveModel(model) {
  switch (model) {
    case "fast":
      return { provider: "openai", model: "gpt-4o-mini" };
    case "smart":
      return { provider: "openai", model: "gpt-4o" };
    case "codex":
      return { provider: "openai", model: "gpt-4.1" };
    case "image":
      return { provider: "openai", model: "gpt-image-1" };
    default:
      return { provider: "openai", model: "gpt-4o-mini" };
  }
}

/* ===========================
   STREAM HELPERS
=========================== */
function sse(res, obj) {
  res.write(`${JSON.stringify(obj)}\n`);
}

/* ===========================
   OPENAI STREAM
=========================== */
async function streamOpenAI(res, payload, route) {
  const stream = await openai.chat.completions.create({
    model: route.model,
    stream: true,
    messages: [
      { role: "system", content: "You are CodeX. Be precise, safe, and helpful." },
      { role: "user", content: payload.prompt }
    ]
  });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) {
      sse(res, { type: "text", data: token });
    }
  }
}

/* ===========================
   OLLAMA STREAM (OPTIONAL)
=========================== */
async function streamOllama(res, payload) {
  const r = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "codellama",
      prompt: payload.prompt,
      stream: true
    })
  });

  const reader = r.body.getReader();
  const dec = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const txt = dec.decode(value);
    sse(res, { type: "text", data: txt });
  }
}

/* ===========================
   IMAGE GENERATION
=========================== */
async function generateImage(res, payload) {
  const img = await openai.images.generate({
    model: "gpt-image-1",
    prompt: payload.prompt,
    size: "1024x1024"
  });

  sse(res, {
    type: "image",
    data: img.data[0].b64_json
      ? `data:image/png;base64,${img.data[0].b64_json}`
      : img.data[0].url
  });
}

/* ===========================
   API SERVER
=========================== */
http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/ai/stream") {
    res.writeHead(200, {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    let body = "";
    req.on("data", d => body += d);
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const { model, prompt } = payload;

        /* MODERATION */
        const mod = moderatePrompt(prompt, model);
        if (mod.blocked) {
          return sse(res, mod);
        }

        /* ROUTE */
        const route = resolveModel(model);

        if (model === "image") {
          await generateImage(res, payload);
          return res.end();
        }

        if (route.provider === "ollama") {
          await streamOllama(res, payload);
        } else {
          await streamOpenAI(res, payload, route);
        }

        res.end();
      } catch (e) {
        sse(res, { blocked: true, reason: "Server error" });
        res.end();
      }
    });
    return;
  }

  /* STATIC FILES */
  let url = req.url === "/" ? "/SE.html" : req.url;
  let filePath = path.join(ROOT, url);
  const ext = path.extname(filePath);

  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  };

  serve(res, filePath, types[ext] || "application/octet-stream");

}).listen(PORT, () => {
  console.log("🔥 HYPINEX CodeX backend running on port", PORT);
});
