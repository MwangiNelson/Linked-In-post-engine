# Ivy's LinkedIn Writer

A small web app that writes **current-affairs LinkedIn posts in the voice of
Ivy Nyakinywa Ndung'u** (Actuarial Associate at Inclusivity Solutions), ready
to copy and paste onto LinkedIn.

- **Web-grounded**: posts are based on live web search, so they reference recent,
  real developments.
- **Two brains with automatic fallback**: uses **Groq** (`groq/compound`, free
  tier, built-in web search) first, and falls back to **Google Gemini** (with
  Google Search grounding) if Groq is out of credits or erroring — and vice
  versa. Set which one leads.
- **Topic control**: default topics (insurance, microinsurance, climate risk,
  sustainability impact, actuarial data) plus **add your own** topics.
- **Copy-paste output**: you review, copy, and post manually. Nothing is
  auto-posted.
- **Deploys to Vercel** with zero npm dependencies.

```
You pick a topic  ->  Groq/Gemini web-search + write as Ivy  ->  you copy  ->  paste to LinkedIn
```

---

## What's inside

```
linkedin-writer/
├── api/
│   └── generate.js      # serverless endpoint: topic -> post
├── lib/
│   ├── persona.js       # Ivy's voice + writing rules
│   └── models.js        # Groq + Gemini calls, with fallback
├── public/
│   └── index.html       # the UI (topic chips, generate, copy)
├── vercel.json
├── package.json
├── .env.example
└── .gitignore
```

---

## 1. Get your two API keys

### Groq (primary — free)
1. Sign in at https://console.groq.com
2. Go to **API Keys** → **Create API Key**: https://console.groq.com/keys
3. Copy the key. Groq's free tier includes `groq/compound` with web search.

### Gemini (fallback)
1. Go to https://aistudio.google.com/app/apikey
2. **Create API key** (free tier works to start).
3. Copy the key.

You only strictly need one to run, but adding both is the whole point — when one
runs out, the app keeps working on the other.

---

## 2. Deploy to Vercel (recommended path)

### Option A — from GitHub (easiest)
1. Put this folder in a GitHub repo (don't commit `.env*`).
2. Go to https://vercel.com/new and **import** the repo.
3. Framework preset: **Other** (no build step needed).
4. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `GROQ_API_KEY` | your Groq key |
   | `GEMINI_API_KEY` | your Gemini key |
   | `PRIMARY_PROVIDER` | `groq` (or `gemini`) |
   | `GROQ_MODEL` | `groq/compound` (optional) |
   | `GEMINI_MODEL` | `gemini-2.5-flash` (optional) |

5. Click **Deploy**. Open the URL Vercel gives you and start writing.

### Option B — from your machine with the CLI
```bash
npm i -g vercel
cd linkedin-writer
vercel            # follow prompts to link the project
vercel env add GROQ_API_KEY
vercel env add GEMINI_API_KEY
vercel env add PRIMARY_PROVIDER      # enter: groq
vercel --prod
```

> To change keys later: Vercel Dashboard → your project → **Settings →
> Environment Variables**, then redeploy.

---

## 3. Run locally (optional)

**Simplest — no CLI, no install (just Node 18+):**
```bash
cd linkedin-writer
cp .env.example .env.local   # fill in GROQ_API_KEY and GEMINI_API_KEY
node dev-server.js           # open http://localhost:3000
```
On start it prints whether each API key was found.

**Or with the Vercel CLI** (mirrors production exactly):
```bash
npm i -g vercel
cd linkedin-writer
cp .env.example .env.local   # fill in your keys
vercel dev                   # opens http://localhost:3000
```

---

## 4. Using it

1. Click a **topic chip**, or type a new topic and hit **Add**.
2. (Optional) add an angle in the instruction box — e.g. "tie it to a recent
   Kenya report" or "keep it reflective".
3. Click **Write the post**. The model searches the web and drafts as Ivy.
4. Read it, click **Regenerate** if you want another take, then **Copy**.
5. Paste into LinkedIn, give it a final human once-over, and post.

The badge on each post tells you which model wrote it and whether it fell back.
If sources are available, they appear under the post so you can fact-check.

---

## 5. Tuning

- **Change the voice**: edit `lib/persona.js` (the `systemPrompt`). This is where
  Ivy's tone, structure, and "sound human" rules live.
- **Swap models**: change `GROQ_MODEL` / `GEMINI_MODEL` env vars. If Groq
  releases a new compound model or you prefer a different Gemini model, just
  update the value.
- **Flip the order**: set `PRIMARY_PROVIDER=gemini` to lead with Gemini.
- **Default topics**: edit `DEFAULT_TOPICS` near the top of the `<script>` in
  `public/index.html`.

## 6. Notes

- Posts are **drafts**. Always read before posting — the app grounds on live
  search but you are the editor and the accountable author.
- Keys live only in Vercel's server environment; they are never sent to the
  browser.
- No database, no accounts, no tracking. Custom topics are stored in your
  browser's local storage.
