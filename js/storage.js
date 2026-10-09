(function attachShiguangStorage(global) {
  "use strict";

  const ITEMS_KEY = "shiguang.items.v1";
  const OWNER_KEY = "shiguang.owner.v1";

  function createId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === "function") return `${prefix}-${global.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function isStoredItem(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const fields = ["id", "type", "name", "category", "location", "eventAt", "description", "contact", "status", "publishedAt", "ownerId"];
    if (!fields.every((key) => typeof item[key] === "string" && item[key].trim())) return false;
    const statuses = item.type === "lost" ? ["searching", "recovered"] : item.type === "found" ? ["pending", "returned"] : [];
    return statuses.includes(item.status) && Number.isFinite(Date.parse(item.eventAt)) && Number.isFinite(Date.parse(item.publishedAt));
  }

  function loadItems() {
    let raw;
    try {
      raw = global.localStorage.getItem(ITEMS_KEY);
    } catch (_) {
      return { ok: false, items: [], reason: "unavailable" };
    }
    if (raw === null) return { ok: true, items: [] };
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return { ok: false, items: [], reason: "corrupt" };
      const ids = new Set();
      const items = parsed.filter((item) => {
        if (!isStoredItem(item) || ids.has(item.id)) return false;
        ids.add(item.id);
        return true;
      });
      return items.length === parsed.length ? { ok: true, items } : { ok: false, items, reason: "corrupt" };
    } catch (_) {
      return { ok: false, items: [], reason: "corrupt" };
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
    const loaded = loadItems();
    if (!loaded.ok) return { ok: false, reason: loaded.reason };
    if (!isStoredItem(item)) return { ok: false, reason: "invalid" };
    const current = loaded.items;
    if (current.some((stored) => stored.id === item.id)) return { ok: false, reason: "duplicate" };
    try {
      current.push(item);
      global.localStorage.setItem(ITEMS_KEY, JSON.stringify(current));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error.name === "QuotaExceededError" ? "quota" : "unavailable" };
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
