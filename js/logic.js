(function attachShiguangLogic(global) {
  "use strict";

  const limits = { name: 50, location: 100, description: 500, contact: 80 };
  const categories = ["校园卡", "水杯", "钥匙", "雨伞", "电子设备", "书籍文具", "其他"];

  function parseEventTime(value) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
    if (!parts) return null;
    const [, year, month, day, hour, minute, second = "0", fraction = "0"] = parts;
    const date = new Date(value);
    // Date 会把 2 月 30 日等输入自动滚到下个月，必须核对本地日期各部分。
    if (Number(year) < 1 || date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) ||
        date.getDate() !== Number(day) || date.getHours() !== Number(hour) || date.getMinutes() !== Number(minute) ||
        date.getSeconds() !== Number(second) || date.getMilliseconds() !== Number(fraction.padEnd(3, "0"))) return null;
    return date;
  }

  function validate(values, now = Date.now()) {
    const errors = {};
    const fields = [
      ["name", "物品名称", limits.name],
      ["category", "物品类别"],
      ["location", "地点", limits.location],
      ["eventAt", "时间"],
      ["description", "物品描述", limits.description],
      ["contact", "联系方式", limits.contact]
    ];

    fields.forEach(([key, label, maxLength]) => {
      const value = typeof values[key] === "string" ? values[key].trim() : "";
      if (!value) errors[key] = `请填写${label}`;
      else if (maxLength && value.length > maxLength) errors[key] = `${label}不能超过${maxLength}个字符`;
    });

    if (!errors.eventAt) {
      const eventTime = parseEventTime(values.eventAt);
      const timeLabel = values.type === "found" ? "拾取时间" : "丢失时间";
      if (!eventTime) errors.eventAt = `请选择有效的${timeLabel}`;
      else if (eventTime.getTime() > now) errors.eventAt = `${timeLabel}不能晚于当前时间`;
    }
    if (values.category && !categories.includes(values.category)) errors.category = "请选择有效的物品类别";
    if (values.type !== "lost" && values.type !== "found") errors.type = "请选择发布寻物或发布招领";
    return { valid: Object.keys(errors).length === 0, errors };
  }

  function createItem(values, ownerId, id, publishedAt) {
    const type = values.type;
    return {
      id,
      type,
      name: values.name.trim(),
      category: values.category,
      location: values.location.trim(),
      eventAt: new Date(values.eventAt).toISOString(),
      description: values.description.trim(),
      contact: values.contact.trim(),
      status: type === "lost" ? "searching" : "pending",
      publishedAt,
      ownerId
    };
  }

  const searchKeywordLimit = 100;

  function normalizeSearchText(value) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
  }

  function searchItems(items, keyword) {
    if (!Array.isArray(items) || typeof keyword !== "string") return [];
    if (keyword.trim().length > searchKeywordLimit) return [];
    const normalizedKeyword = normalizeSearchText(keyword);
    if (!normalizedKeyword) return [];
    const searchableFields = ["name", "category", "location", "description"];
    return items.filter((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      if (typeof item.id !== "string" || !item.id.trim()) return false;
      return searchableFields.some((field) => typeof item[field] === "string" && normalizeSearchText(item[field]).includes(normalizedKeyword));
    }).sort((left, right) => {
      const leftTime = typeof left.publishedAt === "string" ? Date.parse(left.publishedAt) : Number.NEGATIVE_INFINITY;
      const rightTime = typeof right.publishedAt === "string" ? Date.parse(right.publishedAt) : Number.NEGATIVE_INFINITY;
      const safeLeftTime = Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY;
      const safeRightTime = Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY;
      return safeRightTime === safeLeftTime ? 0 : safeRightTime - safeLeftTime;
    });
  }

  function filterItems(items, options = {}) {
    if (!Array.isArray(items) || !options || typeof options !== "object" || Array.isArray(options)) return [];
    const type = options.type;
    if (!["lost", "found", "latest"].includes(type)) return [];
    const category = typeof options.category === "string" ? options.category.trim() : "";
    const location = typeof options.location === "string"
      ? options.location.trim().replace(/\s+/g, " ").toLowerCase()
      : "";
    return items.filter((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      if (type !== "latest" && item.type !== type) return false;
      if (category && item.category !== category) return false;
      if (location) {
        const itemLocation = typeof item.location === "string"
          ? item.location.trim().replace(/\s+/g, " ").toLowerCase()
          : "";
        if (!itemLocation.includes(location)) return false;
      }
      return true;
    }).sort((left, right) => {
      const leftTime = typeof left.publishedAt === "string" ? Date.parse(left.publishedAt) : Number.NEGATIVE_INFINITY;
      const rightTime = typeof right.publishedAt === "string" ? Date.parse(right.publishedAt) : Number.NEGATIVE_INFINITY;
      const safeLeftTime = Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY;
      const safeRightTime = Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY;
      return safeRightTime === safeLeftTime ? 0 : safeRightTime - safeLeftTime;
    });
  }

  function getItemById(items, id) {
    // ID 是不透明的字符串：不自动转换数字、不修剪后再比较。
    if (!Array.isArray(items) || typeof id !== "string" || !id.trim()) return null;
    return items.find((item) => item && typeof item === "object" && !Array.isArray(item) &&
      typeof item.id === "string" && item.id === id) || null;
  }

  function getCompletedStatus(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    if (item.type === "lost") return "recovered";
    if (item.type === "found") return "returned";
    return null;
  }

  function completionCheck(item, ownedItems) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.id !== "string" || !item.id.trim()) {
      return { ok: false, reason: "invalid-id" };
    }
    if (!Array.isArray(ownedItems)) return { ok: false, reason: "not-owned" };
    const matches = ownedItems.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry) && entry.id === item.id);
    if (matches.length !== 1 || item.ownerId === "demo") return { ok: false, reason: "not-owned" };
    const owned = matches[0];
    if (owned.ownerId === "demo" || owned.type !== item.type || owned.status !== item.status || owned.ownerId !== item.ownerId) {
      return { ok: false, reason: "stale" };
    }
    const completedStatus = getCompletedStatus(owned);
    if (!completedStatus) return { ok: false, reason: "invalid-type" };
    if (owned.status === completedStatus || owned.status === "recovered" || owned.status === "returned") {
      return { ok: false, reason: "already-completed" };
    }
    const expectedStatus = owned.type === "lost" ? "searching" : "pending";
    if (owned.status !== expectedStatus) return { ok: false, reason: "invalid-status" };
    return { ok: true, owned, completedStatus };
  }

  function canCompleteItem(item, ownedItems) {
    return completionCheck(item, ownedItems).ok;
  }

  function completeItem(item, ownedItems) {
    const check = completionCheck(item, ownedItems);
    if (!check.ok) return check;
    return { ok: true, item: { ...check.owned, status: check.completedStatus } };
  }

  global.ShiguangLogic = Object.freeze({ validate, createItem, searchItems, filterItems, getItemById, getCompletedStatus, canCompleteItem, completeItem, searchKeywordLimit, categories, limits });
})(window);
