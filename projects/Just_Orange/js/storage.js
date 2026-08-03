/**
 * Just Orange — localStorage helpers (free, private, offline)
 */
(function (global) {
  "use strict";

  const KEYS = {
    history: "jo_history_v1",
    favorites: "jo_favorites_v1",
    pantry: "jo_pantry_v1",
    shopping: "jo_shopping_v1",
    settings: "jo_settings_v1",
    stats: "jo_stats_v1",
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  // —— History ——
  function getHistory() {
    return read(KEYS.history, []);
  }

  function pushHistory(entry) {
    const list = getHistory();
    const item = {
      id: entry.id || "h-" + Date.now(),
      name: entry.name,
      emoji: entry.emoji || "🍊",
      recipe: entry.recipe,
      ingredients: entry.ingredients,
      taste: entry.taste,
      source: entry.source || "local",
      ts: Date.now(),
      meta: entry.meta || null,
    };
    // de-dupe by name+ingredients within last entry
    const filtered = list.filter(
      (x) => !(x.name === item.name && x.ingredients === item.ingredients)
    );
    filtered.unshift(item);
    write(KEYS.history, filtered.slice(0, 50));
    bumpStat("generated");
    return item;
  }

  function clearHistory() {
    write(KEYS.history, []);
  }

  function removeHistory(id) {
    write(
      KEYS.history,
      getHistory().filter((x) => x.id !== id)
    );
  }

  // —— Favorites ——
  function getFavorites() {
    return read(KEYS.favorites, []);
  }

  function isFavorite(id) {
    return getFavorites().some((f) => f.id === id);
  }

  function toggleFavorite(entry) {
    const list = getFavorites();
    const idx = list.findIndex((f) => f.id === entry.id);
    if (idx >= 0) {
      list.splice(idx, 1);
      write(KEYS.favorites, list);
      return false;
    }
    list.unshift({
      id: entry.id,
      name: entry.name,
      emoji: entry.emoji || "🍊",
      recipe: entry.recipe,
      ts: Date.now(),
      meta: entry.meta || null,
    });
    write(KEYS.favorites, list.slice(0, 100));
    return true;
  }

  // —— Pantry ——
  function getPantry() {
    return read(KEYS.pantry, []);
  }

  function setPantry(items) {
    const cleaned = [...new Set(items.map((s) => String(s).toLowerCase().trim()).filter(Boolean))];
    write(KEYS.pantry, cleaned);
    return cleaned;
  }

  function addToPantry(item) {
    const p = getPantry();
    const t = String(item).toLowerCase().trim();
    if (t && !p.includes(t)) p.push(t);
    write(KEYS.pantry, p);
    return p;
  }

  function removeFromPantry(item) {
    write(
      KEYS.pantry,
      getPantry().filter((x) => x !== item)
    );
  }

  // —— Shopping ——
  function getShopping() {
    return read(KEYS.shopping, []);
  }

  function setShopping(items) {
    write(KEYS.shopping, items);
  }

  function addShopping(items) {
    const cur = getShopping();
    const set = new Set(cur.map((x) => x.name || x));
    for (const i of items) {
      const name = typeof i === "string" ? i : i.name;
      if (!set.has(name)) {
        cur.push({ name, done: false });
        set.add(name);
      }
    }
    write(KEYS.shopping, cur);
    return cur;
  }

  function toggleShoppingItem(name) {
    const cur = getShopping().map((x) =>
      x.name === name ? { ...x, done: !x.done } : x
    );
    write(KEYS.shopping, cur);
    return cur;
  }

  function clearShoppingDone() {
    write(
      KEYS.shopping,
      getShopping().filter((x) => !x.done)
    );
  }

  // —— Settings ——
  function getSettings() {
    return read(KEYS.settings, {
      defaultTaste: "savory",
      defaultPrep: 15,
      defaultEat: 30,
      openaiKey: "",
      useAiFallback: false,
      apiUrl: "https://22fhma7fza.execute-api.ap-south-1.amazonaws.com/prod/generate",
    });
  }

  function saveSettings(partial) {
    const next = { ...getSettings(), ...partial };
    write(KEYS.settings, next);
    return next;
  }

  // —— Stats ——
  function getStats() {
    return read(KEYS.stats, { generated: 0, cooked: 0, favorites: 0 });
  }

  function bumpStat(key) {
    const s = getStats();
    s[key] = (s[key] || 0) + 1;
    write(KEYS.stats, s);
    return s;
  }

  global.JustOrangeStorage = {
    getHistory,
    pushHistory,
    clearHistory,
    removeHistory,
    getFavorites,
    isFavorite,
    toggleFavorite,
    getPantry,
    setPantry,
    addToPantry,
    removeFromPantry,
    getShopping,
    setShopping,
    addShopping,
    toggleShoppingItem,
    clearShoppingDone,
    getSettings,
    saveSettings,
    getStats,
    bumpStat,
  };
})(typeof window !== "undefined" ? window : globalThis);
