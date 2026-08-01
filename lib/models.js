// Dual-model generation with automatic fallback.
// Primary/fallback order is set by PRIMARY_PROVIDER (default gemini).
// Gemini uses the google_search grounding tool; Groq uses groq/compound
// (built-in web search). If one fails (missing key, quota/429/413, error),
// we transparently switch to the other so posts keep flowing.

const {
  systemPrompt,
  userPrompt,
  refineSystemPrompt,
  refineUserPrompt,
} = require("./persona");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

const env = (k, d = "") => (process.env[k] || d).trim();

// ---------------- Groq (OpenAI-compatible) ----------------
async function callGroq(system, user) {
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
      // Kept tight: on Groq's free tier the whole request (prompt + injected
      // web-search results + max_tokens) is charged against an 8,000 tokens/min
      // ceiling, and going over returns 429 / 413. A 220-word post plus
      // hashtags is comfortably under 500 tokens.
      max_tokens: 600,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
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
async function callGemini(system, user) {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const model = env("GEMINI_MODEL", "gemini-3.6-flash");
  const url = GEMINI_URL.replace("{model}", model);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
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

  // Models slip in typographic look-alikes that read as stray glyphs once the
  // text is pasted into LinkedIn, and an em dash is the persona's loudest tell.
  t = t
    .replace(/\u2011/g, "-")          // non-breaking hyphen
    .replace(/\u00A0/g, " ")          // non-breaking space
    .replace(/\u202F/g, " ")          // narrow no-break space
    .replace(/(\d)\s+%/g, "$1%")      // "28 %" -> "28%"
    .replace(/\s*\u2014\s*/g, " - "); // em dash

  // Collapse runs of blank lines but keep the paragraph breaks the post needs.
  return t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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
async function runWithFallback(system, user) {
  const primary = env("PRIMARY_PROVIDER", "gemini").toLowerCase();
  const order =
    primary === "groq" ? [callGroq, callGemini] : [callGemini, callGroq];

  const errors = [];
  for (const fn of order) {
    try {
      const result = await fn(system, user);
      result.fellBack = errors.length > 0;
      return result;
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error("Both providers failed. " + errors.join(" | "));
}

async function generatePost(topic, guidance) {
  if (!topic || !topic.trim()) throw new Error("A topic is required.");
  return runWithFallback(systemPrompt(), userPrompt(topic, guidance));
}

// Revise an existing post. The whole post goes back to the model as context so
// it edits in place instead of writing something new on the same topic.
async function refinePost(post, instruction, topic) {
  const body = (post || "").trim();
  if (!body) throw new Error("There is no post to refine yet.");
  return runWithFallback(
    refineSystemPrompt(),
    refineUserPrompt(body, instruction, topic)
  );
}

module.exports = { generatePost, refinePost, callGroq, callGemini, cleanPost };
