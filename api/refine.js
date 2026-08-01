// Vercel serverless function: POST /api/refine
// Body: { "post": "the current draft", "instruction": "make it shorter", "topic": "optional" }
// Returns: { post, provider, model, fellBack, sources, chars }
//
// The whole current draft (including Ivy's own edits) is sent back as context
// so the model revises it rather than writing a fresh post on the same topic.

const { refinePost } = require("../lib/models");
const { readJson } = require("../lib/read-json");

// Roughly two LinkedIn posts' worth. Keeps the request inside Groq's
// free-tier per-minute token budget even with search results injected.
const MAX_POST_CHARS = 8000;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  try {
    const body = await readJson(req);
    const post = (body.post || "").toString().trim();
    const instruction = (body.instruction || "").toString().trim();
    const topic = (body.topic || "").toString().trim();

    if (!post) {
      res.status(400).json({ error: "There is no post to refine yet." });
      return;
    }
    if (post.length > MAX_POST_CHARS) {
      res.status(400).json({
        error: `That draft is ${post.length} characters. Trim it below ${MAX_POST_CHARS} to refine it.`,
      });
      return;
    }

    const result = await refinePost(post, instruction, topic);
    res.status(200).json({
      post: result.text,
      provider: result.provider,
      model: result.model,
      fellBack: !!result.fellBack,
      sources: result.sources || [],
      chars: result.text.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Refine failed." });
  }
};
