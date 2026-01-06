// server.js
import http from "http";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();

// Initialize OpenAI if API key exists
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
      return { blocked: true, reason: `Disallowed content: ${word}` };
    }
  }

  if (mode === "image" && lower.includes("real person")) {
    return { blocked: true, reason: "Real-person image generation not allowed" };
  }

  return { blocked: false };
}

/* ===========================
   MODEL ROUTER
=========================== */
function resolveModel(model) {
  switch (model) {
    case "fast": return { provider: "openai", model: "gpt-4o-mini" };
    case "smart": return { provider: "openai", model: "gpt-4o" };
    case "codex": return { provider: "openai", model: "gpt-4.1" };
    case "image": return { provider: "openai", model: "gpt-image-1" };
    default: return { provider: "openai", model: "gpt-4o-mini" };
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
    if (token) sse(res, { type: "text", data: token });
  }
}

/* ===========================
   OLLAMA STREAM (LOCAL)
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

  const reader = r.body.getRead
