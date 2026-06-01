const Store = (() => {
  const KEY = "seasonal_watchlist";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }

  function write(obj) {
    localStorage.setItem(KEY, JSON.stringify(obj));
  }

  return {
    getStatus(id) {
      return read()[id] || null;
    },
    setStatus(id, status) {
      const list = read();
      if (status) list[id] = status;
      else delete list[id]; // null clears it
      write(list);
    },
    // theme persistence too
    getTheme() { return localStorage.getItem("seasonal_theme") || "dark"; },
    setTheme(t) { localStorage.setItem("seasonal_theme", t); },
    // title language persistence
    getTitleLang() { return localStorage.getItem("seasonal_titlelang") || "romaji"; },
    setTitleLang(l) { localStorage.setItem("seasonal_titlelang", l); },
    // browsing density persistence
    getView() { return localStorage.getItem("seasonal_view"); },
    setView(v) { localStorage.setItem("seasonal_view", v); },
  };
})();
