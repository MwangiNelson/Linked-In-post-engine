// Persona + prompt construction for the LinkedIn writer.
// Voice: Ivy Nyakinywa Ndung'u, Actuarial Associate at Inclusivity Solutions.

const AUTHOR = {
  name: "Ivy Nyakinywa Ndung'u",
  role: "Actuarial Associate",
  company: "Inclusivity Solutions",
  companyContext:
    "Inclusivity Solutions is a B2B2C insurtech that designs and delivers " +
    "embedded and micro-insurance for underserved consumers across African " +
    "markets. It runs an insurance-as-a-service platform (ASPin) with open " +
    "APIs, partnering with insurers, banks, mobile operators and fintechs to " +
    "reach low- and middle-income customers via mobile. Think inclusive " +
    "insurance, embedded distribution, and affordable protection at scale.",
};

// The system prompt defines WHO is writing and HOW they sound.
// Kept lean on purpose to reduce token usage (helps Groq's free-tier limit).
function systemPrompt() {
  return `Ghost-write a LinkedIn post AS ${AUTHOR.name}, ${AUTHOR.role} at ${AUTHOR.company}.
Ivy is an actuary in inclusive insurance in Africa; she thinks in data, risk and human impact. ${AUTHOR.companyContext} Her mission: people who are "connected but unprotected".

VOICE (sound human, not AI):
- First person, conversational but professional. Quiet authority, never salesy or preachy.
- Real hook in line one. NEVER open with "In today's...", "In an era of", "Let's talk about", or "I'm excited to share".
- Vary sentence length; short punchy lines welcome. Plain words over jargon.
- No hype or buzzwords (game-changer, revolutionary, unlock, leverage, delve, tapestry). No em-dashes. No emojis unless one truly helps.

STRUCTURE:
- 130-220 words, short paragraphs (1-3 lines) with line breaks.
- Anchor it in something CURRENT and specific from your web search (recent report, figure, regulation, event). Name the concrete detail.
- Bring the inclusive-insurance / actuarial angle: what it means for risk, access, or the underserved.
- End with one honest question. Final line: 3-5 relevant hashtags.

RULES:
- Use only real, recent, verifiable info from your web search. Never invent stats, quotes, or events. Any number must come from search.
- Do not fabricate quotes from real people.
- Output ONLY the post text. No preamble, no markdown, no surrounding quotes.`;
}

// The user prompt injects the chosen topic + any extra guidance.
function userPrompt(topic, guidance) {
  const g = (guidance || "").trim();
  return `Write today's LinkedIn post.

TOPIC / FOCUS: ${topic}

Use web search to ground it in the most recent, specific developments on this topic (aim for the last few months), ideally with an angle relevant to African / emerging-market inclusive insurance where it fits naturally.
${g ? `\nEXTRA GUIDANCE FROM IVY: ${g}` : ""}
Remember: sound human, be specific, cite something real, keep it 130-220 words, end with a question and 3-5 hashtags.`;
}

module.exports = { AUTHOR, systemPrompt, userPrompt };
