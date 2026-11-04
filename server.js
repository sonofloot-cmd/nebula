const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query || query.length > 200) {
      return res.status(400).json({
        error: "Invalid search query"
      });
    }

    const searchUrl = new URL(
      "https://YOUR-SEARXNG-INSTANCE/search"
    );

    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("format", "json");

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "NebulaSearch/1.0"
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error("Search provider unavailable");
    }

    const data = await response.json();

    const results = (data.results || []).slice(0, 10).map(item => ({
      title: item.title || "Untitled",
      url: item.url,
      description: item.content || ""
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
  res.json({ status: "online", name: "Nebula" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nebula running on port ${PORT}`);
});
