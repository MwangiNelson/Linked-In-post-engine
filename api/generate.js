// Vercel serverless function: POST /api/generate
// Body: { "topic": "microinsurance", "guidance": "optional angle" }
// Returns: { post, provider, model, fellBack, sources, chars }

const { generatePost } = require("../lib/models");
const { readJson } = require("../lib/read-json");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  try {
    const body = await readJson(req);
    const topic = (body.topic || "").toString().trim();
    const guidance = (body.guidance || "").toString().trim();

    if (!topic) {
      res.status(400).json({ error: "Please choose or enter a topic." });
      return;
    }

    const result = await generatePost(topic, guidance);
    res.status(200).json({
      post: result.text,
      provider: result.provider,
      model: result.model,
      fellBack: !!result.fellBack,
      sources: result.sources || [],
      chars: result.text.length,
    });
  } catch (e) {
    // Missing keys / both providers down land here as a clean 500.
    res.status(500).json({ error: e.message || "Generation failed." });
  }
};
