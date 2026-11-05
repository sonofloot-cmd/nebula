
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search");
const addressForm = document.getElementById("address-form");
const addressInput = document.getElementById("address");

const results = document.getElementById("results");
const resultCount = document.getElementById("result-count");
const homeScreen = document.getElementById("home-screen");
const browser = document.getElementById("browser");
const viewer = document.getElementById("viewer");
const status = document.getElementById("browser-status");
const tabsElement = document.getElementById("tabs");
const placeholder = document.getElementById("viewer-placeholder");

let tabs = [];
let activeTabId = null;
let nextTabId = 1;

function safeUrl(value) {
  try {
    const url = new URL(
      value.includes("://") ? value : `https://${value}`
    );

    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;

    if (
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local")
    ) return null;

    return url.href;
  } catch {
    return null;
  }
}

function activeTab() {
  return tabs.find(tab => tab.id === activeTabId);
}

function showBrowser() {
  homeScreen.hidden = true;
  browser.hidden = false;
}

function showHome() {
  browser.hidden = true;
  homeScreen.hidden = false;
}

function renderTabs() {
  tabsElement.querySelectorAll(".tab").forEach(tab => tab.remove());

  const newButton = document.getElementById("new-tab");

  tabs.forEach(tab => {
    const button = document.createElement("button");
    button.className = "tab";
    button.type = "button";
    button.textContent = tab.title || "New tab";
    button.setAttribute("aria-pressed", String(tab.id === activeTabId));

    if (tab.id === activeTabId) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      switchTab(tab.id);
    });

    const close = document.createElement("span");
    close.className = "tab-close";
    close.textContent = " ×";
    close.title = "Close tab";

    close.addEventListener("click", event => {
      event.stopPropagation();
      closeTab(tab.id);
    });

    button.appendChild(close);
    tabsElement.insertBefore(button, newButton);
  });
}

function switchTab(id) {
  const tab = tabs.find(item => item.id === id);
  if (!tab) return;

  activeTabId = id;
  showBrowser();
  addressInput.value = tab.url || "";

  if (tab.url) {
    viewer.hidden = false;
    placeholder.hidden = true;

    if (viewer.src !== tab.url) viewer.src = tab.url;

    status.textContent = `Viewing ${new URL(tab.url).hostname}`;
  } else {
    viewer.src = "about:blank";
    viewer.hidden = true;
    placeholder.hidden = false;
    status.textContent = "New tab";
  }

  renderTabs();
}

function createTab(url = "") {
  const tab = {
    id: nextTabId++,
    url: "",
    title: "New tab",
    history: [],
    historyIndex: -1
  };

  tabs.push(tab);
  activeTabId = tab.id;

  renderTabs();

  if (url) {
    navigate(url);
  } else {
    switchTab(tab.id);
  }
}

function navigate(value, saveHistory = true) {
  const url = safeUrl(value);

  if (!url) {
    status.textContent = "Invalid website address.";
    return;
  }

  const tab = activeTab();
  if (!tab) return;

  if (saveHistory) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(url);
    tab.historyIndex++;
  }

  tab.url = url;
  tab.title = new URL(url).hostname;

  showBrowser();
  addressInput.value = url;
  viewer.hidden = false;
  placeholder.hidden = true;
  status.textContent = `Loading ${tab.title}...`;

  viewer.src = url;
  renderTabs();
}

function closeTab(id) {
  const index = tabs.findIndex(tab => tab.id === id);
  if (index === -1) return;

  tabs.splice(index, 1);

  if (tabs.length === 0) {
    createTab();
    return;
  }

  if (activeTabId === id) {
    const next = tabs[Math.max(0, index - 1)];
    switchTab(next.id);
  } else {
    renderTabs();
  }
}

async function searchWeb(query) {
  results.replaceChildren();
  resultCount.textContent = "Searching...";

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

    const items = Array.isArray(data.results) ? data.results : [];
    resultCount.textContent = `${items.length} results`;

    if (!items.length) {
      results.textContent = "No results found.";
      return;
    }

    items.forEach(item => {
      const article = document.createElement("article");
      article.className = "result";

      const title = document.createElement("h3");
      title.textContent = item.title || "Untitled";

      const description = document.createElement("p");
      description.textContent = item.description || "";

      const button = document.createElement("button");
      button.textContent = "View inside Nebula";

      button.addEventListener("click", () => {
        createTab(item.url);
      });

      article.append(title, description, button);
      results.appendChild(article);
    });
  } catch (error) {
    resultCount.textContent = "Search unavailable";
    results.textContent = error.message;
  }
}

viewer.addEventListener("load", () => {
  const tab = activeTab();

  if (tab && tab.url) {
    status.textContent =
      "Page loaded. Some websites block embedded viewing.";
  }
});

searchForm.addEventListener("submit", event => {
  event.preventDefault();

  const query = searchInput.value.trim();
  if (query) searchWeb(query);
});

addressForm.addEventListener("submit", event => {
  event.preventDefault();

  const value = addressInput.value.trim();
  if (!value) return;

  const url = safeUrl(value);

  if (url && (
    /^https?:\/\//i.test(value) ||
    /^[a-z0-9-]+\.[a-z]{2,}/i.test(value)
  )) {
    if (!activeTab()) createTab();
    navigate(url);
  } else {
    showHome();
    searchInput.value = value;
    searchWeb(value);
  }
});

document.getElementById("new-tab").addEventListener("click", () => {
  createTab();
});

document.getElementById("home").addEventListener("click", () => {
  showHome();
  viewer.src = "about:blank";
});

document.getElementById("refresh").addEventListener("click", () => {
  const tab = activeTab();
  if (tab && tab.url) {
    status.textContent = "Refreshing...";
    viewer.src = tab.url;
  }
});

document.getElementById("back").addEventListener("click", () => {
  const tab = activeTab();

  if (tab && tab.historyIndex > 0) {
    tab.historyIndex--;
    navigate(tab.history[tab.historyIndex], false);
  }
});

document.getElementById("forward").addEventListener("click", () => {
  const tab = activeTab();

  if (tab && tab.historyIndex < tab.history.length - 1) {
    tab.historyIndex++;
    navigate(tab.history[tab.historyIndex], false);
  }
});

document.getElementById("open-external").addEventListener("click", () => {
  const tab = activeTab();

  if (tab && tab.url) {
    window.open(tab.url, "_blank", "noopener,noreferrer");
  }
});

createTab();
