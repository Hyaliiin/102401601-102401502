"use strict";

const sampleItems = [
  { id: "item-001", type: "lost", name: "蓝色水杯", category: "水杯", location: "图书馆二楼", eventAt: "2026-10-09T08:50:00+08:00", description: "蓝色随行水杯。", contact: "", status: "searching", publishedAt: "2026-10-09T09:20:00+08:00", ownerId: "demo" },
  { id: "item-002", type: "found", name: "一串钥匙", category: "钥匙", location: "第一食堂门口", eventAt: "2026-10-08T17:50:00+08:00", description: "拾到一串钥匙，请失主核对。", contact: "", status: "pending", publishedAt: "2026-10-08T18:10:00+08:00", ownerId: "demo" },
  { id: "item-003", type: "found", name: "黑色折叠伞", category: "雨伞", location: "教学楼一楼", eventAt: "2026-10-07T12:10:00+08:00", description: "黑色折叠伞，已交还失主。", contact: "", status: "returned", publishedAt: "2026-10-07T12:30:00+08:00", ownerId: "demo" }
];

const itemIcons = { 校园卡: "🎫", 水杯: "🥤", 钥匙: "🔑", 雨伞: "☂️", 电子设备: "🎧", 书籍文具: "📚", 其他: "📦" };
const typeLabels = { lost: "寻物", found: "招领" };
const statusLabels = { searching: "寻找中", pending: "待认领", recovered: "已找回", returned: "已归还" };
const filterLabels = { lost: "寻物信息", found: "招领信息", latest: "最新发布" };
const viewElements = {
  home: document.querySelector("#home-view"),
  search: document.querySelector("#search-view"),
  publish: document.querySelector("#publish-view"),
  success: document.querySelector("#success-view")
};
const headerTitle = document.querySelector("#header-title");
const headerSubtitle = document.querySelector("#header-subtitle");
const searchButton = document.querySelector("#search-entry");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-keyword");
const clearSearchButton = document.querySelector("#clear-search");
const searchError = document.querySelector("#search-error");
const searchSuggestions = document.querySelector("#search-suggestions");
const searchResultsSection = document.querySelector("#search-results");
const searchResultList = document.querySelector("#search-result-list");
const searchEmpty = document.querySelector("#search-empty");
const searchStatus = document.querySelector("#search-status");
const searchFeedback = document.querySelector("#search-feedback");
const quickKeywords = document.querySelectorAll(".quick-keyword");
const homeNav = document.querySelector('[data-page="home"]');
const publishNav = document.querySelector('[data-page="publish"]');
const tabs = document.querySelectorAll(".filter-tab");
const form = document.querySelector("#publish-form");
const submitButton = document.querySelector("#submit-publish");
const formError = document.querySelector("#form-error");
const formInfo = document.querySelector("#form-info");
const locationLabel = document.querySelector("#location-label");
const eventTimeLabel = document.querySelector("#event-time-label");
const locationInput = document.querySelector("#item-location");
const eventTimeInput = document.querySelector("#event-time");
const modeButtons = document.querySelectorAll(".mode-button");
const fieldInputs = {
  name: document.querySelector("#item-name"),
  category: document.querySelector("#item-category"),
  location: locationInput,
  eventAt: eventTimeInput,
  description: document.querySelector("#item-description"),
  contact: document.querySelector("#item-contact")
};
const storageResult = window.ShiguangStorage.loadItems();
let userItems = storageResult.items;
let allItems = [...sampleItems, ...userItems];
let currentFilter = "lost";
let currentMode = "lost";
let isSubmitting = false;
let lastPublishedItem = null;
let hasValidationErrors = false;
let selectedItemId = null;
let isSearchComposing = false;
let previousSearchValue = "";

window.ShiguangApp = Object.freeze({ getSelectedItemId: () => selectedItemId });

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function visibleItems(filter) {
  const selected = filter === "latest" ? [...allItems] : allItems.filter((item) => item.type === filter);
  return selected.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function formatPublishedAt(value) {
  if (typeof value !== "string") return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function createItemCard(item) {
  const name = typeof item.name === "string" && item.name.trim() ? item.name : "未命名物品";
  const locationText = typeof item.location === "string" && item.location.trim() ? item.location : "地点未提供";
  const card = document.createElement("article");
  card.className = "item-card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.dataset.itemId = item.id;
  card.setAttribute("aria-label", `查看${name}详情`);

  const top = document.createElement("div");
  top.className = "card-top";
  top.append(textElement("span", "type-label", lookupLabel(typeLabels, item.type, "信息")));
  const status = textElement("span", `status-label${["returned", "recovered"].includes(item.status) ? " completed" : ""}`, lookupLabel(statusLabels, item.status, "状态未知"));
  top.append(status);

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";
  const icon = textElement("span", "item-icon", lookupLabel(itemIcons, item.category, itemIcons["其他"]));
  icon.setAttribute("aria-hidden", "true");
  titleRow.append(icon, textElement("h3", "card-title", name));

  const location = textElement("p", "card-location", `📍 ${locationText}`);
  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.append(textElement("span", "", `发布于 ${formatPublishedAt(item.publishedAt)}`));
  meta.append(textElement("span", "", "查看详情 ›"));
  card.append(top, titleRow, location, meta);
  return card;
}

function lookupLabel(labels, value, fallback) {
  return typeof value === "string" && Object.hasOwn(labels, value) ? labels[value] : fallback;
}

function renderItems(filter) {
  const list = document.querySelector("#item-list");
  const items = visibleItems(filter);
  document.querySelector("#result-count").textContent = `${items.length} 条信息`;
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.append(textElement("strong", "", `暂时没有${filterLabels[filter]}记录`));
    empty.append(textElement("span", "", "有新的信息时，会第一时间出现在这里。"));
    list.append(empty);
    return;
  }
  items.forEach((item) => list.append(createItemCard(item)));
}

function selectFilter(button) {
  currentFilter = button.dataset.filter;
  tabs.forEach((tab) => {
    const selected = tab === button;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  renderItems(currentFilter);
}

function showItemFeedback(card) {
  const item = allItems.find((entry) => entry.id === card.dataset.itemId);
  if (!item) return;
  selectedItemId = item.id;
  const feedback = viewElements.search.hidden
    ? document.querySelector("#interaction-feedback")
    : document.querySelector("#search-feedback");
  const name = typeof item.name === "string" ? item.name : "未命名物品";
  feedback.textContent = `已选择“${name}”，详情页面将在后续阶段开放。`;
  if (feedback === searchFeedback) feedback.hidden = false;
  card.classList.add("is-selected");
  window.setTimeout(() => card.classList.remove("is-selected"), 700);
}

function showPage(page) {
  if (page === "publish") {
    if (isSubmitting && lastPublishedItem) resetForm();
    updateEventTimeLimit();
  }
  if (page === "home") renderItems(currentFilter);
  const visiblePage = page === "success" ? "success" : page;
  Object.entries(viewElements).forEach(([name, element]) => { element.hidden = name !== visiblePage; });
  const onPublish = page === "publish" || page === "success";
  const headerTitles = { home: ["拾光", "校园失物招领"], search: ["搜索物品", "找到校园里的线索"], publish: ["发布信息", "让线索留下，让物品回家"], success: ["发布成功", "让线索留下，让物品回家"] };
  [headerTitle.textContent, headerSubtitle.textContent] = headerTitles[page];
  searchButton.hidden = page !== "home";
  homeNav.classList.toggle("active", page === "home");
  publishNav.classList.toggle("active", onPublish);
  if (page === "home") {
    homeNav.setAttribute("aria-current", "page");
    publishNav.removeAttribute("aria-current");
  } else if (onPublish) {
    publishNav.setAttribute("aria-current", "page");
    homeNav.removeAttribute("aria-current");
  } else {
    homeNav.removeAttribute("aria-current");
    publishNav.removeAttribute("aria-current");
  }
  const heading = { home: "#items-title", search: "#search-title", publish: "#publish-title", success: "#success-title" };
  document.querySelector(heading[page]).focus();
}

function showSearchInputState() {
  searchSuggestions.hidden = false;
  searchResultsSection.hidden = true;
  searchEmpty.hidden = true;
  searchError.hidden = true;
  searchError.textContent = "";
  searchInput.removeAttribute("aria-invalid");
  searchResultList.replaceChildren();
  document.querySelector("#search-result-count").textContent = "";
  document.querySelector("#search-summary").textContent = "";
  document.querySelector("#search-empty-message").textContent = "";
  searchStatus.textContent = "";
  searchFeedback.textContent = "";
  searchFeedback.hidden = true;
  selectedItemId = null;
}

function resetSearch(announce = false) {
  searchInput.value = "";
  previousSearchValue = "";
  clearSearchButton.hidden = true;
  showSearchInputState();
  if (announce) searchStatus.textContent = "已清空关键词，请重新输入或选择快捷关键词。";
}

function performSearch() {
  const keyword = searchInput.value.trim();
  previousSearchValue = searchInput.value;
  showSearchInputState();
  clearSearchButton.hidden = searchInput.value.length === 0;
  if (!keyword || keyword.length > window.ShiguangLogic.searchKeywordLimit) {
    searchError.textContent = keyword ? `关键词不能超过 ${window.ShiguangLogic.searchKeywordLimit} 个字符。` : "请输入关键词后再搜索。";
    searchError.hidden = false;
    searchInput.setAttribute("aria-invalid", "true");
    searchInput.focus();
    return;
  }

  searchInput.value = keyword;
  previousSearchValue = keyword;
  searchSuggestions.hidden = true;
  const results = window.ShiguangLogic.searchItems(allItems, keyword);
  if (!results.length) {
    searchResultsSection.hidden = true;
    searchEmpty.hidden = false;
    document.querySelector("#search-empty-message").textContent = `没有找到包含“${keyword}”的物品。你可以换个关键词，或发布寻物信息。`;
    searchStatus.textContent = `没有找到“${keyword}”的相关物品。`;
    document.querySelector("#search-empty-title").focus();
    return;
  }

  searchEmpty.hidden = true;
  searchResultsSection.hidden = false;
  document.querySelector("#search-result-count").textContent = `${results.length} 条`;
  document.querySelector("#search-summary").textContent = `“${keyword}”的搜索结果，共 ${results.length} 条信息`;
  results.forEach((item) => searchResultList.append(createItemCard(item)));
  searchStatus.textContent = `找到 ${results.length} 条相关信息，按发布时间从新到旧排列。`;
  document.querySelector("#search-results-title").focus();
}

function setMode(mode) {
  currentMode = mode;
  modeButtons.forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const lost = mode === "lost";
  locationLabel.firstChild.textContent = lost ? "丢失地点 " : "拾取地点 ";
  eventTimeLabel.firstChild.textContent = lost ? "丢失时间 " : "拾取时间 ";
  locationInput.placeholder = lost ? "例如：图书馆二楼" : "例如：第一食堂门口";
  eventTimeInput.setAttribute("aria-label", lost ? "丢失时间" : "拾取时间");
  document.querySelector("#publish-title").textContent = lost ? "发布寻物信息" : "发布招领信息";
  if (hasValidationErrors) showValidationErrors(window.ShiguangLogic.validate(formValues()).errors, false);
}

function updateEventTimeLimit() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  eventTimeInput.max = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function formValues() {
  return {
    type: currentMode,
    name: document.querySelector("#item-name").value,
    category: document.querySelector("#item-category").value,
    location: locationInput.value,
    eventAt: eventTimeInput.value,
    description: document.querySelector("#item-description").value,
    contact: document.querySelector("#item-contact").value
  };
}

function showValidationErrors(errors, focusFirst = true) {
  Object.entries(fieldInputs).forEach(([key, input]) => {
    const message = document.querySelector(`#${input.id}-error`);
    message.textContent = errors[key] || "";
    message.hidden = !errors[key];
    if (errors[key]) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  });
  hasValidationErrors = Object.keys(errors).length > 0;
  formError.textContent = Object.values(errors).join("；");
  formError.hidden = !hasValidationErrors;
  if (focusFirst && hasValidationErrors) (fieldInputs[Object.keys(errors)[0]] || formError).focus();
}

function setSubmitting(value) {
  isSubmitting = value;
  submitButton.disabled = value;
  submitButton.textContent = value ? "正在保存…" : "发布信息";
  form.setAttribute("aria-busy", String(value));
}

function showSaveError(reason) {
  const messages = {
    corrupt: "本地发布记录已损坏，暂时无法保存新信息。原数据未被覆盖，请先备份并检查浏览器本地数据；当前填写内容已保留。",
    quota: "浏览器本地存储空间不足，信息未发布。请释放空间后重试，当前填写内容已保留。",
    duplicate: "记录编号冲突，请重新提交，当前填写内容已保留。",
    invalid: "发布记录格式不正确，信息未保存。当前填写内容已保留，请检查后重试。"
  };
  setSubmitting(false);
  formError.textContent = messages[reason] || "当前浏览器无法访问本地存储，信息未发布。请检查浏览器设置后重试，当前填写内容已保留。";
  formError.hidden = false;
  formError.focus();
}

function resetForm() {
  form.reset();
  setSubmitting(false);
  showValidationErrors({}, false);
  formInfo.hidden = true;
  formInfo.textContent = "";
  setMode("lost");
}

function handlePublish(event) {
  event.preventDefault();
  if (isSubmitting) return;
  showValidationErrors({}, false);
  updateEventTimeLimit();
  const values = formValues();
  const validation = window.ShiguangLogic.validate(values);
  if (!validation.valid) {
    showValidationErrors(validation.errors);
    return;
  }

  setSubmitting(true);
  let item;
  try {
    const ownerId = window.ShiguangStorage.getOwnerId();
    let id = window.ShiguangStorage.createId("item");
    const existingIds = new Set(allItems.map((item) => item.id));
    for (let attempts = 0; existingIds.has(id) && attempts < 5; attempts += 1) id = window.ShiguangStorage.createId("item");
    if (existingIds.has(id)) {
      showSaveError("duplicate");
      return;
    }
    item = window.ShiguangLogic.createItem(values, ownerId, id, new Date().toISOString());
    const result = window.ShiguangStorage.saveItem(item);
    if (!result.ok) {
      showSaveError(result.reason);
      return;
    }
  } catch (error) {
    showSaveError(error.name === "QuotaExceededError" ? "quota" : "unavailable");
    return;
  }
  // 保存成功后保持提交锁，直到用户主动开始下一次发布。
  form.setAttribute("aria-busy", "false");
  submitButton.textContent = "已发布";
  lastPublishedItem = item;
  userItems = [...userItems, item];
  allItems = [...sampleItems, ...userItems];
  document.querySelector("#success-item-name").textContent = item.name;
  document.querySelector("#success-status").textContent = statusLabels[item.status];
  document.querySelector("#success-action-feedback").hidden = true;
  showPage("success");
}

tabs.forEach((button) => button.addEventListener("click", () => selectFilter(button)));
[document.querySelector("#item-list"), searchResultList].forEach((list) => {
  list.addEventListener("click", (event) => {
    const card = event.target.closest(".item-card");
    if (card) showItemFeedback(card);
  });
  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.isComposing) return;
    const card = event.target.closest(".item-card");
    if (!card) return;
    event.preventDefault();
    if (event.repeat) return;
    showItemFeedback(card);
  });
});
modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
form.addEventListener("submit", handlePublish);
eventTimeInput.addEventListener("focus", updateEventTimeLimit);
["input", "change"].forEach((eventName) => form.addEventListener(eventName, () => {
  if (hasValidationErrors) showValidationErrors(window.ShiguangLogic.validate(formValues()).errors, false);
}));

document.querySelectorAll(".nav-item").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  if (link.dataset.page === "home") showPage("home");
  else if (link.dataset.page === "publish") {
    showPage("publish");
  }
  else {
    formInfo.textContent = "我的发布管理将在后续阶段开放。";
    formInfo.hidden = false;
    showPage("publish");
  }
}));

searchButton.addEventListener("click", () => {
  resetSearch();
  showPage("search");
  searchInput.focus();
});
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isSearchComposing || event.isComposing) return;
  performSearch();
});
function handleSearchInput() {
  previousSearchValue = searchInput.value;
  clearSearchButton.hidden = searchInput.value.length === 0;
  showSearchInputState();
}
searchInput.addEventListener("input", handleSearchInput);
searchInput.addEventListener("compositionstart", () => { isSearchComposing = true; });
searchInput.addEventListener("compositionend", () => { isSearchComposing = false; });
searchInput.addEventListener("search", () => {
  // Chrome 在 Enter 提交时也会触发 search；只处理从有内容到清空的变化。
  if (!searchInput.value && previousSearchValue) handleSearchInput();
});
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !event.isComposing && !isSearchComposing) {
    event.preventDefault();
    resetSearch(true);
    searchInput.focus();
  }
});
clearSearchButton.addEventListener("click", () => {
  resetSearch(true);
  searchInput.focus();
});
quickKeywords.forEach((button) => button.addEventListener("click", () => {
  searchInput.value = button.dataset.keyword;
  clearSearchButton.hidden = false;
  performSearch();
}));
document.querySelector("#search-back").addEventListener("click", () => {
  showPage("home");
  searchButton.focus();
});
document.querySelector("#no-result-search").addEventListener("click", () => {
  showSearchInputState();
  searchInput.focus();
  searchInput.select();
});
document.querySelector("#refine-search").addEventListener("click", () => {
  searchInput.focus();
  searchInput.select();
});
document.querySelector("#no-result-publish").addEventListener("click", () => {
  showPage("publish");
  setMode("lost");
  fieldInputs.name.focus();
});
document.querySelector("#view-details").addEventListener("click", () => {
  const feedback = document.querySelector("#success-action-feedback");
  feedback.textContent = lastPublishedItem ? "详情页面将在后续阶段开放；这条信息已保存，可在首页信息列表中查看。" : "暂时没有可查看的信息。";
  feedback.hidden = false;
});
document.querySelector("#continue-publishing").addEventListener("click", () => {
  resetForm();
  showPage("publish");
  document.querySelector("#item-name").focus();
});
document.querySelector("#return-home").addEventListener("click", () => {
  currentFilter = "latest";
  selectFilter(document.querySelector('[data-filter="latest"]'));
  showPage("home");
});

if (!storageResult.ok) {
  formInfo.textContent = storageResult.reason === "corrupt"
    ? "部分本地发布记录已损坏；可读取的记录和示例仍可查看。为保护原数据，暂时停止保存新信息，请先备份并检查本地数据。"
    : "当前浏览器无法读取本地发布信息；示例内容仍可查看，但发布内容可能无法保存。";
  formInfo.hidden = false;
}
renderItems(currentFilter);
setMode("lost");
