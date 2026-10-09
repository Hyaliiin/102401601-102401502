(function attachShiguangStorage(global) {
  "use strict";

  const ITEMS_KEY = "shiguang.items.v1";
  const OWNER_KEY = "shiguang.owner.v1";

  function createId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === "function") return `${prefix}-${global.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function loadItems() {
    try {
      const raw = global.localStorage.getItem(ITEMS_KEY);
      if (raw === null) return { ok: true, items: [] };
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return { ok: false, items: [] };
      return { ok: true, items: parsed.filter((item) => item && typeof item === "object" && typeof item.id === "string") };
    } catch (_) {
      return { ok: false, items: [] };
    }
  }

  function getOwnerId() {
    const existing = global.localStorage.getItem(OWNER_KEY);
    if (existing) return existing;
    const ownerId = createId("owner");
    global.localStorage.setItem(OWNER_KEY, ownerId);
    return ownerId;
  }

  function saveItem(item) {
    try {
      const raw = global.localStorage.getItem(ITEMS_KEY);
      const current = raw === null ? [] : JSON.parse(raw);
      if (!Array.isArray(current)) return { ok: false, reason: "unavailable" };
      if (current.some((stored) => stored && stored.id === item.id)) return { ok: false, reason: "duplicate" };
      current.push(item);
      global.localStorage.setItem(ITEMS_KEY, JSON.stringify(current));
      return { ok: true };
    } catch (_) {
      return { ok: false, reason: "unavailable" };
    }
  }

  global.ShiguangStorage = Object.freeze({
    loadItems,
    saveItem,
    getOwnerId,
    createId,
    itemsKey: ITEMS_KEY
  });
})(window);
