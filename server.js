
const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-src": ["https:"],
      "frame-ancestors": ["'self'"]
    }
  }
}));

app.use(express.static(path.join(__dirname, "public")));

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.get("/api/search", searchLimiter, async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query || query.length > 200) {
      return res.status(400).json({
        error: "Invalid search query"
      });
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tavily-Access-Mode": "keyless"
      },
      body: JSON.stringify({
        query,
        topic: "general",
        search_depth: "basic",
        max_results: 10
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Search provider returned ${response.status}`);
    }

    const data = await response.json();

    res.json({
      results: (data.results || []).map(item => ({
        title: String(item.title || "Untitled"),
        url: item.url,
        description: String(item.content || "")
      }))
    });
  } catch (error) {
    console.error("Search error:", error.message);

    res.status(502).json({
      error: "Search is temporarily unavailable."
    });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    name: "Nebula"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nebula running on port ${PORT}`);
});
