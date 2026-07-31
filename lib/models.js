// Dual-model generation with automatic fallback.
// Primary/fallback order is set by PRIMARY_PROVIDER (default gemini).
// Gemini uses the google_search grounding tool; Groq uses groq/compound
// (built-in web search). If one fails (missing key, quota/429/413, error),
// we transparently switch to the other so posts keep flowing.

const { systemPrompt, userPrompt } = require("./persona");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

const env = (k, d = "") => (process.env[k] || d).trim();

// ---------------- Groq (OpenAI-compatible) ----------------
async function callGroq(topic, guidance) {
  const key = env("GROQ_API_KEY");
  if (!key) throw new Error("GROQ_API_KEY not set");

  const model = env("GROQ_MODEL", "groq/compound");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.85,
      // Kept modest: on Groq's free tier the whole request (prompt +
      // injected web-search results + max_tokens) must fit ~6,000 tokens/min
      // or Groq returns 413 request_too_large.
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userPrompt(topic, guidance) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message || {};
  const text = (msg.content || "").trim();
  if (!text) throw new Error("Groq returned an empty post");

  return { text: cleanPost(text), provider: "groq", model, sources: extractGroqSources(msg) };
}

function extractGroqSources(msg) {
  // groq/compound may report tool calls it executed, sometimes with URLs.
  const out = [];
  const tools = msg.executed_tools || msg.tool_calls || [];
  for (const t of tools) {
    const raw = JSON.stringify(t);
    for (const u of raw.match(/https?:\/\/[^\s"'\\)]+/g) || []) out.push({ url: u });
  }
  return dedupeSources(out);
}

// ---------------- Gemini (grounded with Google Search) ----------------
async function callGemini(topic, guidance) {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const model = env("GEMINI_MODEL", "gemini-3.6-flash");
  const url = GEMINI_URL.replace("{model}", model);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      contents: [{ role: "user", parts: [{ text: userPrompt(topic, guidance) }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const cand = data.candidates?.[0] || {};
  const text = (cand.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty post");

  return {
    text: cleanPost(text),
    provider: "gemini",
    model,
    sources: extractGeminiSources(cand),
  };
}

function extractGeminiSources(cand) {
  const chunks = cand.groundingMetadata?.groundingChunks || [];
  const out = chunks
    .map((c) => c.web)
    .filter(Boolean)
    .map((w) => ({ url: w.uri, title: w.title }));
  return dedupeSources(out);
}

// ---------------- shared helpers ----------------
function cleanPost(text) {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function dedupeSources(list) {
  const seen = new Set();
  const out = [];
  for (const s of list) {
    if (!s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out.slice(0, 6);
}

// ---------------- orchestration with fallback ----------------
async function generatePost(topic, guidance) {
  if (!topic || !topic.trim()) throw new Error("A topic is required.");

  const primary = env("PRIMARY_PROVIDER", "gemini").toLowerCase();
  const order =
    primary === "groq" ? [callGroq, callGemini] : [callGemini, callGroq];

  const errors = [];
  for (const fn of order) {
    try {
      const result = await fn(topic, guidance);
      result.fellBack = errors.length > 0;
      return result;
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error("Both providers failed. " + errors.join(" | "));
}

module.exports = { generatePost, callGroq, callGemini, cleanPost };
