const App = (() => {
  // ---- state ----
  let allAnime = [];      
  let currentSeason = "now";
  let activeGenre = null;
  let searchTerm = "";
  let sortBy = "default";
  let viewMode = "cards";
  let seasonRequest = 0;
  let lastDrawerTrigger = null;
  let openDrawerEl = null;
  const airedEpisodeCache = new Map();
  const EPISODE_LOOKUP_DELAY = 1100;

  // ---- elements ----
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const seasonToggle = document.getElementById("seasonToggle");
  const themeSwitch = document.getElementById("themeSwitch");
  const langSwitch = document.getElementById("langSwitch");
  const seasonMarkerText = document.getElementById("seasonMarkerText");
  const currentSeasonLabel = document.getElementById("currentSeasonLabel");
  const viewToggle = document.getElementById("viewToggle");
  const filterSwitch = document.getElementById("filterSwitch");
  const filterCount = document.getElementById("filterCount");
  const menuSwitch = document.getElementById("menuSwitch");
  const filterDrawer = document.getElementById("filterDrawer");
  const menuDrawer = document.getElementById("menuDrawer");
  const drawerSortSelect = document.getElementById("drawerSortSelect");
  const clearFilters = document.getElementById("clearFilters");
  const emptyClearFilters = document.getElementById("emptyClearFilters");
  const drawerLangSwitch = document.getElementById("drawerLangSwitch");
  const drawerLangValue = document.getElementById("drawerLangValue");
  const drawerThemeSwitch = document.getElementById("drawerThemeSwitch");
  const drawerThemeValue = document.getElementById("drawerThemeValue");

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function renderSeasonMarker(season) {
    const now = new Date();
    const seasons = ["Winter", "Spring", "Summer", "Fall"];
    const index = Math.floor(now.getMonth() / 3) + (season === "upcoming" ? 1 : 0);
    seasonMarkerText.textContent = season === "upcoming" ? "Upcoming season" : "Current season";
    currentSeasonLabel.textContent = `${seasons[index % 4]} ${now.getFullYear() + Math.floor(index / 4)}`;
  }

  // Pick the most common season/year reported by the loaded entries.
  // Returns "Spring 2026" or null when nothing carries a season (e.g. all TBA).
  function seasonFromData(list) {
    const counts = {};
    for (const a of list) {
      if (a.season && a.year) {
        const key = `${a.season} ${a.year}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!best) return null;
    const [season, year] = best[0].split(" ");
    return `${season[0].toUpperCase()}${season.slice(1)} ${year}`;
  }

  // ---- derive genre list from loaded anime ----
  function collectGenres(list) {
    const set = new Set();
    list.forEach((a) => (a.genres || []).forEach((g) => set.add(g.name)));
    return [...set].sort();
  }

  // ---- apply search + filter + sort, then render ----
  function update() {
    let view = [...allAnime];

    if (activeGenre) {
      view = view.filter((a) =>
        (a.genres || []).some((g) => g.name === activeGenre)
      );
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      view = view.filter((a) => {
        const hay = ((a.title || "") + " " + (a.title_english || "") + " " + (a.title_japanese || "")).toLowerCase();
        return hay.includes(q);
      });
    }

    switch (sortBy) {
      case "score":      view.sort((a, b) => (b.score || 0) - (a.score || 0)); break;
      case "popularity": view.sort((a, b) => (a.popularity || 9e9) - (b.popularity || 9e9)); break;
      case "episodes":   view.sort((a, b) => (b.episodes || 0) - (a.episodes || 0)); break;
    }

    UI.renderCards(view);
  }

  function updateFilterCount() {
    const count = Number(Boolean(activeGenre)) + Number(sortBy !== "default");
    filterCount.textContent = count;
    filterCount.hidden = count === 0;
  }

  // ---- re-render genre pills with current active state ----
  function refreshGenres() {
    UI.renderGenres(collectGenres(allAnime), activeGenre, (g) => {
      activeGenre = g;
      refreshGenres();
      updateFilterCount();
      update();
    });
  }

  // ---- progressively load aired episode counts without flooding Jikan ----
  async function hydrateAiredEpisodes(list, request) {
    for (const anime of list) {
      if (request !== seasonRequest) return;

      if (airedEpisodeCache.has(anime.mal_id)) {
        anime.airedEpisodes = airedEpisodeCache.get(anime.mal_id);
        UI.updateEpisodeBadge(anime);
        continue;
      }

      try {
        const count = await API.getAiredEpisodeCount(anime.mal_id);
        if (request !== seasonRequest) return;
        airedEpisodeCache.set(anime.mal_id, count);
        anime.airedEpisodes = count;
        UI.updateEpisodeBadge(anime);
      } catch (err) {
        // Keep the total episode fallback when an individual lookup fails.
      }

      await new Promise((resolve) => setTimeout(resolve, EPISODE_LOOKUP_DELAY));
    }
  }

  // ---- load a season ----
  async function loadSeason(season) {
    const request = ++seasonRequest;
    currentSeason = season;
    renderSeasonMarker(season);
    activeGenre = null;
    updateFilterCount();
    UI.renderSkeletons();
    try {
      allAnime = season === "now"
        ? await API.getCurrentSeason()
        : await API.getUpcoming();
      if (request !== seasonRequest) return;

      // de-dupe by mal_id (Jikan sometimes repeats an entry across pages)
      const seen = new Set();
      allAnime = allAnime.filter((a) => {
        if (seen.has(a.mal_id)) return false;
        seen.add(a.mal_id);
        return true;
      });

      // Refine the clock-based label with what the data actually reports.
      const dataLabel = seasonFromData(allAnime);
      if (dataLabel) currentSeasonLabel.textContent = dataLabel;

      refreshGenres();
      update();
      if (season === "now") hydrateAiredEpisodes(allAnime, request);
    } catch (err) {
      document.getElementById("animeGrid").innerHTML =
        `<p class="empty">Couldn't reach the API. Refresh to retry.</p>`;
    }
  }

  // ---- theme ----
  function initTheme() {
    const saved = Store.getTheme();
    document.documentElement.dataset.theme = saved;
    syncPreferenceLabels();
  }
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    Store.setTheme(next);
    syncPreferenceLabels();
  }

  // ---- title language ----
  function initTitleLang() {
    const lang = Store.getTitleLang();
    UI.setTitleLang(lang);
    document.documentElement.dataset.titlelang = lang;
    syncPreferenceLabels();
  }
  function toggleTitleLang() {
    const next = document.documentElement.dataset.titlelang === "english" ? "romaji" : "english";
    document.documentElement.dataset.titlelang = next;
    Store.setTitleLang(next);
    UI.setTitleLang(next);
    syncPreferenceLabels();
    update();
  }

  // ---- view density ----
  function setViewMode(mode, persist = true) {
    viewMode = mode === "compact" ? "compact" : "cards";
    document.documentElement.dataset.view = viewMode;
    document.getElementById("animeGrid").dataset.view = viewMode;
    [...viewToggle.querySelectorAll(".view-toggle__btn")].forEach((button) => {
      const selected = button.dataset.view === viewMode;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", selected);
    });
    if (persist) Store.setView(viewMode);
  }

  function initViewMode() {
    const saved = Store.getView();
    const deviceDefault = window.matchMedia("(max-width: 767px)").matches ? "compact" : "cards";
    setViewMode(saved || deviceDefault, false);
  }

  function syncPreferenceLabels() {
    const lang = document.documentElement.dataset.titlelang || Store.getTitleLang();
    const theme = document.documentElement.dataset.theme || Store.getTheme();
    drawerLangValue.textContent = lang === "english" ? "English" : "Romaji";
    drawerThemeValue.textContent = theme === "light" ? "Light" : "Dark";
  }

  // ---- mobile drawers (Filters: sort + genres / Menu: preferences) ----
  function openDrawer(drawer, trigger) {
    lastDrawerTrigger = trigger;
    openDrawerEl = drawer;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    trigger.setAttribute("aria-expanded", "true");
    drawer.querySelector(".drawer__panel").focus();
  }

  function closeDrawer() {
    if (!openDrawerEl) return;
    openDrawerEl.classList.remove("is-open");
    openDrawerEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");
    if (lastDrawerTrigger) {
      lastDrawerTrigger.setAttribute("aria-expanded", "false");
      lastDrawerTrigger.focus();
    }
    openDrawerEl = null;
  }

  function clearActiveFilters() {
    activeGenre = null;
    sortBy = "default";
    searchTerm = "";
    searchInput.value = "";
    sortSelect.value = sortBy;
    drawerSortSelect.value = sortBy;
    refreshGenres();
    updateFilterCount();
    update();
  }

  function keepDrawerFocus(e) {
    if (e.key !== "Tab" || !openDrawerEl) return;
    const panel = openDrawerEl.querySelector(".drawer__panel");
    const focusable = [...panel.querySelectorAll("button:not([disabled]), select:not([disabled])")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ---- events ----
  function bind() {
    const runSearch = debounce(update, 180);
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value.trim();
      runSearch();
    });

    sortSelect.addEventListener("change", (e) => {
      sortBy = e.target.value;
      drawerSortSelect.value = sortBy;
      updateFilterCount();
      update();
    });

    drawerSortSelect.addEventListener("change", (e) => {
      sortBy = e.target.value;
      sortSelect.value = sortBy;
      updateFilterCount();
      update();
    });

    seasonToggle.addEventListener("click", (e) => {
      const btn = e.target.closest(".season-toggle__btn");
      if (!btn) return;
      [...seasonToggle.children].forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      searchInput.value = "";
      searchTerm = "";
      loadSeason(btn.dataset.season);
    });

    themeSwitch.addEventListener("click", toggleTheme);
    langSwitch.addEventListener("click", toggleTitleLang);
    drawerThemeSwitch.addEventListener("click", toggleTheme);
    drawerLangSwitch.addEventListener("click", toggleTitleLang);

    viewToggle.addEventListener("click", (e) => {
      const button = e.target.closest(".view-toggle__btn");
      if (!button) return;
      setViewMode(button.dataset.view);
      update();
    });

    filterSwitch.addEventListener("click", () => openDrawer(filterDrawer, filterSwitch));
    menuSwitch.addEventListener("click", () => openDrawer(menuDrawer, menuSwitch));
    [filterDrawer, menuDrawer].forEach((drawer) => {
      drawer.addEventListener("click", (e) => {
        if (e.target.dataset.drawerClose !== undefined) closeDrawer();
      });
    });
    clearFilters.addEventListener("click", clearActiveFilters);
    emptyClearFilters.addEventListener("click", clearActiveFilters);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openDrawerEl) closeDrawer();
      keepDrawerFocus(e);
    });
    window.matchMedia("(min-width: 768px)").addEventListener("change", (e) => {
      if (e.matches) closeDrawer();
    });

    // re-render cards when watch status changes in modal
    document.addEventListener("statusChanged", update);
  }

  // ---- init ----
  function start() {
    initTheme();
    initTitleLang();
    initViewMode();
    bind();
    loadSeason("now");
  }

  return { start };
})();

document.addEventListener("DOMContentLoaded", App.start);
