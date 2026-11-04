
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["https:", "http:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null
    }
  }
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.get("/api/search", searchLimiter, async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query || query.length > 200) {
      return res.status(400).json({
        error: "Please enter a valid search query."
      });
    }

    const provider = process.env.SEARXNG_URL;

    if (!provider) {
      return res.status(503).json({
        error: "Search provider has not been configured yet."
      });
    }

    const baseUrl = new URL(provider);

    if (
      !["https:", "http:"].includes(baseUrl.protocol) ||
      baseUrl.username ||
      baseUrl.password
    ) {
      throw new Error("Invalid search provider configuration.");
    }

    const searchUrl = new URL("/search", baseUrl.origin);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("format", "json");

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "NebulaSearch/1.0"
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error("Search provider unavailable.");
    }

    const data = await response.json();

    const results = (data.results || [])
      .filter(item => {
        try {
          const url = new URL(item.url);
          return ["http:", "https:"].includes(url.protocol);
        } catch {
          return false;
        }
      })
      .slice(0, 10)
      .map(item => ({
        title: String(item.title || "Untitled").slice(0, 300),
        url: item.url,
        description: String(item.content || "").slice(0, 1000)
      }));

    res.json({ results });

  } catch (error) {
    console.error(error.message);

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
