const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search");
const addressForm = document.getElementById("address-form");
const addressInput = document.getElementById("address");

const results = document.getElementById("results");
const homeScreen = document.getElementById("home-screen");
const browser = document.getElementById("browser");
const viewer = document.getElementById("viewer");
const status = document.getElementById("browser-status");

let historyStack = [];
let historyIndex = -1;

function safeUrl(value) {
  try {
    const url = new URL(
      value.includes("://") ? value : `https://${value}`
    );

    if (!["https:", "http:"].includes(url.protocol)) {
      return null;
    }

    if (url.username || url.password) return null;

    if (
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local")
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

async function searchWeb(query) {
  results.replaceChildren();

  const loading = document.createElement("p");
  loading.textContent = "Searching the internet...";
  results.appendChild(loading);

  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Search failed.");
    }

    results.replaceChildren();

    if (!data.results.length) {
      results.textContent = "No results found.";
      return;
    }

    data.results.forEach(item => {
      const article = document.createElement("article");
      article.className = "result";

      const title = document.createElement("h3");
      title.textContent = item.title;

      const description = document.createElement("p");
      description.textContent = item.description;

      const button = document.createElement("button");
      button.textContent = "View inside Nebula";

      button.addEventListener("click", () => {
        openWebsite(item.url);
      });

      article.append(title, description, button);
      results.appendChild(article);
    });

  } catch (error) {
    results.textContent = error.message;
  }
}

function openWebsite(value, save = true) {
  const url = safeUrl(value);

  if (!url) {
    status.textContent = "Invalid website address.";
    return;
  }

  if (save) {
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(url);
    historyIndex++;
  }

  homeScreen.hidden = true;
  browser.hidden = false;

  addressInput.value = url;
  status.textContent = `Loading ${new URL(url).hostname}...`;

  viewer.src = url;
}

viewer.addEventListener("load", () => {
  status.textContent =
    "Website loaded. Some websites block embedded viewing.";
});

function goHome() {
  viewer.src = "about:blank";
  browser.hidden = true;
  homeScreen.hidden = false;
  addressInput.value = "";
}

searchForm.addEventListener("submit", event => {
  event.preventDefault();

  const query = searchInput.value.trim();

  if (!query) return;

  searchWeb(query);
});

addressForm.addEventListener("submit", event => {
  event.preventDefault();

  const value = addressInput.value.trim();

  if (!value) return;

  if (
    /^https?:\/\//i.test(value) ||
    /^[a-z0-9-]+\.[a-z]{2,}/i.test(value)
  ) {
    openWebsite(value);
  } else {
    searchInput.value = value;
    goHome();
    searchWeb(value);
  }
});

document.getElementById("home").addEventListener("click", goHome);

document.getElementById("refresh").addEventListener("click", () => {
  if (historyIndex >= 0) {
    viewer.src = historyStack[historyIndex];
  }
});

document.getElementById("back").addEventListener("click", () => {
  if (historyIndex > 0) {
    historyIndex--;
    openWebsite(historyStack[historyIndex], false);
  }
});

document.getElementById("forward").addEventListener("click", () => {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    openWebsite(historyStack[historyIndex], false);
  }
});
