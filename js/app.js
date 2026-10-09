"use strict";

const sampleItems = [
  { id: "item-001", type: "lost", name: "蓝色水杯", category: "水杯", location: "图书馆二楼", eventAt: "2026-10-09T08:50:00+08:00", description: "蓝色随行水杯。", contact: "", status: "searching", publishedAt: "2026-10-09T09:20:00+08:00", ownerId: "demo" },
  { id: "item-002", type: "found", name: "一串钥匙", category: "钥匙", location: "第一食堂门口", eventAt: "2026-10-08T17:50:00+08:00", description: "拾到一串钥匙，请失主核对。", contact: "", status: "pending", publishedAt: "2026-10-08T18:10:00+08:00", ownerId: "demo" },
  { id: "item-003", type: "found", name: "黑色折叠伞", category: "雨伞", location: "教学楼一楼", eventAt: "2026-10-07T12:10:00+08:00", description: "黑色折叠伞，已交还失主。", contact: "", status: "returned", publishedAt: "2026-10-07T12:30:00+08:00", ownerId: "demo" }
];

const itemIcons = { 校园卡: "🎫", 水杯: "🥤", 钥匙: "🔑", 雨伞: "☂️", 电子设备: "🎧", 书籍文具: "📚", 其他: "📦" };
const typeLabels = { lost: "寻物", found: "招领" };
const statusLabels = { searching: "寻找中", pending: "待认领", recovered: "已找到", returned: "已归还" };
const filterLabels = { lost: "寻物信息", found: "招领信息", latest: "最新发布" };
const viewElements = {
  home: document.querySelector("#home-view"),
  search: document.querySelector("#search-view"),
  publish: document.querySelector("#publish-view"),
  success: document.querySelector("#success-view"),
  detail: document.querySelector("#detail-view"),
  "my-posts": document.querySelector("#my-posts-view")
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
const myPostsNav = document.querySelector('[data-page="my-posts"]');
const tabs = document.querySelectorAll(".filter-tab");
const categoryFilter = document.querySelector("#home-category-filter");
const locationFilter = document.querySelector("#home-location-filter");
const clearLocationFilter = document.querySelector("#clear-location-filter");
const myPostFilters = document.querySelectorAll(".my-post-filter");
const myPostList = document.querySelector("#my-post-list");
const myPostFilterCount = document.querySelector("#my-post-filter-count");
const myPostFilterLabels = { all: "全部", active: "进行中", completed: "已完成" };
let currentOwnerId = window.ShiguangStorage.loadOwnerId();
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
let currentMyPostFilter = "all";
let currentPage = "home";
let detailItemId = null;
let detailReturn = { page: "home", id: null, scrollTop: 0, windowY: 0 };
const appContent = document.querySelector("#app-content");
const contactButton = document.querySelector("#view-contact");
const contactDialog = document.querySelector("#contact-dialog");
const contactValue = document.querySelector("#contact-value");
const copyButton = document.querySelector("#copy-contact");
const selectContactButton = document.querySelector("#select-contact");
const closeContactButton = document.querySelector("#close-contact");
const copyFeedback = document.querySelector("#copy-feedback");
let contactSession = 0;
let contactSessionActive = false;
let isCopying = false;
const statusDialog = document.querySelector("#status-confirm-dialog");
const completeItemButton = document.querySelector("#complete-item");
const confirmStatusButton = document.querySelector("#confirm-status-update");
const cancelStatusButton = document.querySelector("#cancel-status-update");
const statusDialogError = document.querySelector("#status-confirm-error");
let isStatusUpdating = false;

window.ShiguangApp = Object.freeze({
  getSelectedItemId: () => selectedItemId,
  getItemById: (id) => window.ShiguangLogic.getItemById(allItems, id)
});

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function visibleItems(filter) {
  return window.ShiguangLogic.filterItems(allItems, {
    type: filter,
    category: categoryFilter.value,
    location: locationFilter.value
  });
}

function updateHomeFilterControlStyles() {
  categoryFilter.classList.toggle("has-value", Boolean(categoryFilter.value));
  locationFilter.classList.toggle("has-value", Boolean(locationFilter.value.trim()));
  clearLocationFilter.hidden = locationFilter.value.length === 0;
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
    const hasRefinements = Boolean(categoryFilter.value || locationFilter.value.trim());
    empty.className = `empty-state${hasRefinements ? " filtered-empty-state" : ""}`;
    const icon = textElement("span", "empty-state-icon", hasRefinements ? "⌕" : "✦");
    icon.setAttribute("aria-hidden", "true");
    empty.append(icon);
    empty.append(textElement("strong", "", hasRefinements ? "没有符合当前筛选条件的信息" : `暂时没有${filterLabels[filter]}记录`));
    empty.append(textElement("span", "empty-state-hint", hasRefinements ? "调整类别或地点关键词，试试其他线索。" : "有新的信息时，会第一时间出现在这里。"));
    if (hasRefinements) {
      const clear = textElement("button", "secondary-button", "清除类别和地点筛选");
      clear.type = "button";
      clear.addEventListener("click", () => {
        categoryFilter.value = "";
        locationFilter.value = "";
        updateHomeFilterControlStyles();
        renderItems(currentFilter);
        categoryFilter.focus();
      });
      empty.append(clear);
    }
    list.append(empty);
    return;
  }
  items.forEach((item) => list.append(createItemCard(item)));
}

function ownedItems() {
  if (typeof currentOwnerId !== "string" || !currentOwnerId.trim()) return [];
  return userItems.filter((item) => item && item.ownerId === currentOwnerId && item.ownerId !== "demo");
}

function renderMyPosts() {
  const records = [...ownedItems()].sort((left, right) => {
    const leftTime = Date.parse(left.publishedAt);
    const rightTime = Date.parse(right.publishedAt);
    return (Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY) -
      (Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY);
  });
  document.querySelector("#my-post-count").textContent = String(records.length);
  const filtered = records.filter((item) => {
    if (currentMyPostFilter === "active") return ["searching", "pending"].includes(item.status);
    if (currentMyPostFilter === "completed") return ["recovered", "returned"].includes(item.status);
    return true;
  });
  myPostFilterCount.textContent = `${myPostFilterLabels[currentMyPostFilter]} ${filtered.length} 条`;
  myPostList.replaceChildren();
  if (filtered.length) {
    filtered.forEach((item) => myPostList.append(createItemCard(item)));
    return;
  }
  const empty = document.createElement("div");
  empty.className = "empty-state my-post-empty";
  if (!records.length) {
    empty.append(textElement("strong", "", "还没有发布记录"));
    empty.append(textElement("span", "", "发布一条寻物或招领信息，线索就会保存在这里。"));
    const publish = textElement("button", "primary-button", "去发布");
    publish.type = "button";
    publish.addEventListener("click", () => { showPage("publish"); fieldInputs.name.focus(); });
    empty.append(publish);
  } else {
    empty.append(textElement("strong", "", `暂无${myPostFilterLabels[currentMyPostFilter]}信息`));
    empty.append(textElement("span", "", "切换筛选条件，查看其他发布记录。"));
    const reset = textElement("button", "secondary-button", "查看全部");
    reset.type = "button";
    reset.addEventListener("click", () => selectMyPostFilter(myPostFilters.find((tab) => tab.dataset.myFilter === "all")));
    empty.append(reset);
  }
  myPostList.append(empty);
}

function selectMyPostFilter(button) {
  if (!button) return;
  currentMyPostFilter = button.dataset.myFilter;
  myPostFilters.forEach((tab) => {
    const selected = tab === button;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.setAttribute("tabindex", selected ? "0" : "-1");
  });
  renderMyPosts();
}

function renderCurrentSearchResults() {
  if (searchResultsSection.hidden) return;
  const results = window.ShiguangLogic.searchItems(allItems, searchInput.value);
  searchResultList.replaceChildren(...results.map(createItemCard));
  document.querySelector("#search-result-count").textContent = `${results.length} 条`;
  document.querySelector("#search-summary").textContent = `“${searchInput.value}”的搜索结果，共 ${results.length} 条信息`;
}

function selectFilter(button) {
  currentFilter = button.dataset.filter;
  tabs.forEach((tab) => {
    const selected = tab === button;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.setAttribute("tabindex", selected ? "0" : "-1");
  });
  renderItems(currentFilter);
}

function showItemFeedback(card) {
  const sourceItems = card.parentElement === myPostList ? ownedItems() : allItems;
  const item = window.ShiguangLogic.getItemById(sourceItems, card.dataset.itemId);
  if (!item) return;
  selectedItemId = item.id;
  const feedback = card.parentElement === searchResultList
    ? searchFeedback
    : document.querySelector("#interaction-feedback");
  // 在选择提示改变列表高度之前保存返回位置。
  openItemDetails(item.id);
  const name = typeof item.name === "string" ? item.name : "未命名物品";
  feedback.textContent = `已选择“${name}”，已打开物品详情。`;
  if (feedback === searchFeedback) feedback.hidden = false;
  card.classList.add("is-selected");
  window.setTimeout(() => card.classList.remove("is-selected"), 700);
}

function showPage(page) {
  if (currentPage === "detail" && page !== "detail") {
    closeContact();
    closeStatusConfirmation();
    updateDetailAddress(null);
  }
  currentPage = page;
  if (page === "publish") {
    if (isSubmitting && lastPublishedItem) resetForm();
    updateEventTimeLimit();
  }
  if (page === "home") renderItems(currentFilter);
  if (page === "my-posts") renderMyPosts();
  const myPostError = document.querySelector("#my-post-error");
  myPostError.hidden = storageResult.ok;
  myPostError.textContent = storageResult.ok ? "" : storageResult.reason === "corrupt"
    ? "本地发布数据有损坏；仅显示可读取的本人记录，状态更新会在检查完成前暂停。原始数据未被覆盖。"
    : "当前浏览器无法读取本地发布信息；请检查浏览器存储设置。";
  const visiblePage = page === "success" ? "success" : page;
  Object.entries(viewElements).forEach(([name, element]) => { element.hidden = name !== visiblePage; });
  const navPage = page === "detail" ? detailReturn.page : page;
  const onPublish = navPage === "publish" || navPage === "success";
  const headerTitles = { home: ["拾光", "校园失物招领"], search: ["搜索物品", "找到校园里的线索"], publish: ["发布信息", "让线索留下，让物品回家"], success: ["发布成功", "让线索留下，让物品回家"], detail: ["物品详情", "让线索与失主相遇"], "my-posts": ["我的发布", "记录每一条线索，也记录每一次找回。"] };
  [headerTitle.textContent, headerSubtitle.textContent] = headerTitles[page];
  searchButton.hidden = page !== "home";
  homeNav.classList.toggle("active", navPage === "home");
  publishNav.classList.toggle("active", onPublish);
  myPostsNav.classList.toggle("active", navPage === "my-posts");
  [homeNav, publishNav, myPostsNav].forEach((link) => link.removeAttribute("aria-current"));
  const activeNav = navPage === "success" ? publishNav : navPage === "home" ? homeNav : navPage === "publish" ? publishNav : navPage === "my-posts" ? myPostsNav : null;
  if (activeNav) activeNav.setAttribute("aria-current", "page");
  const heading = { home: "#items-title", search: "#search-title", publish: "#publish-title", success: "#success-title", detail: "#detail-title", "my-posts": "#my-posts-title" };
  document.querySelector(heading[page]).focus();
}

function detailText(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function formatDetailTime(value) {
  if (typeof value !== "string" || !value.trim()) return "时间未提供";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function updateDetailAddress(id) {
  // 只在地址片段中保存 ID；不写入联系方式，也不改变已有存储结构。
  let hash = "#home";
  if (id !== null) {
    try { hash = `#item=${encodeURIComponent(id)}`; }
    catch (_) { hash = "#item="; }
  }
  try { window.history.replaceState(null, "", hash); }
  catch (_) { window.location.hash = hash; }
}

function restoreDetailAddress(initial = false) {
  if (window.location.hash.startsWith("#item=")) {
    let id = "";
    try { id = decodeURIComponent(window.location.hash.slice(6)); } catch (_) { /* 无效地址显示空状态。 */ }
    // replaceState 的降级路径也会触发 hashchange，避免重复打开和抢走焦点。
    if (currentPage !== "detail" || detailItemId !== id) openItemDetails(id, initial);
  } else if (currentPage === "detail") {
    returnFromDetails();
  }
}

function openItemDetails(id, restore = false) {
  if (currentPage !== "detail" && !restore) {
    detailReturn = { page: currentPage, id, scrollTop: appContent.scrollTop, windowY: window.scrollY };
  }
  closeContact();
  detailItemId = id;
  const item = window.ShiguangLogic.getItemById(allItems, id);
  selectedItemId = item ? item.id : null;
  document.querySelector("#detail-content").hidden = !item;
  document.querySelector("#detail-missing").hidden = Boolean(item);
  contactButton.hidden = !item;
  const warning = document.querySelector("#detail-storage-warning");
  warning.hidden = storageResult.ok;
  warning.textContent = storageResult.ok ? "" : "部分本地记录损坏或无法读取，可能无法显示对应详情。原始数据未被覆盖；可读取的信息仍可查看。";
  // 即使记录无效也清除旧详情，避免残留上一件物品的信息。
  const record = item || {};
  const fields = {
    "detail-name": detailText(record.name, "未命名物品"),
    "detail-type": lookupLabel(typeLabels, record.type, "信息类型未知"),
    "detail-status": lookupLabel(statusLabels, record.status, "状态未知"),
    "detail-published": `发布于 ${formatDetailTime(record.publishedAt)}`,
    "detail-icon": lookupLabel(itemIcons, record.category, itemIcons["其他"]),
    "detail-category": detailText(record.category, "类别未提供"),
    "detail-location-label": record.type === "lost" ? "丢失地点" : record.type === "found" ? "拾取地点" : "地点",
    "detail-location": detailText(record.location, "地点未提供"),
    "detail-time-label": record.type === "lost" ? "丢失时间" : record.type === "found" ? "拾取时间" : "时间",
    "detail-time": formatDetailTime(record.eventAt),
    "detail-description": detailText(record.description, "暂无物品描述。")
  };
  Object.entries(fields).forEach(([key, value]) => { document.querySelector(`#${key}`).textContent = value; });
  document.querySelector("#detail-status").classList.toggle("completed", ["recovered", "returned"].includes(record.status));
  const statusFeedback = document.querySelector("#detail-status-feedback");
  statusFeedback.hidden = true;
  statusFeedback.textContent = "";
  const mayUpdateStatus = Boolean(item && detailReturn.page === "my-posts" && window.ShiguangLogic.canCompleteItem(item, ownedItems()));
  completeItemButton.hidden = !mayUpdateStatus;
  completeItemButton.textContent = record.type === "lost" ? "标记为已找到" : "标记为已归还";
  if (!restore) updateDetailAddress(id);
  showPage("detail");
  if (!item) document.querySelector("#detail-missing-title").focus();
  appContent.scrollTop = 0;
  window.scrollTo(0, 0);
}

function returnFromDetails() {
  const previous = detailReturn;
  if (previous.page === "search") {
    searchFeedback.hidden = true;
    searchFeedback.textContent = "";
  }
  showPage(previous.page);
  const list = previous.page === "search" ? searchResultList : previous.page === "my-posts" ? myPostList : document.querySelector("#item-list");
  const trigger = previous.page === "success" ? document.querySelector("#view-details")
    : Array.from(list.children).find((card) => card.dataset.itemId === previous.id);
  if (trigger) trigger.focus({ preventScroll: true });
  appContent.scrollTop = previous.scrollTop;
  window.scrollTo(0, previous.windowY);
}

function completeStatusError(reason) {
  const messages = {
    "invalid-id": "信息编号无效，请返回“我的发布”重新选择。",
    "not-owned": "只能更新当前浏览器中由你发布的信息。",
    "not-found": "本地记录已不存在，状态没有更改。",
    "corrupt": "本地发布数据损坏，状态没有更改；原始数据未被覆盖。",
    "unavailable": "当前浏览器无法写入本地存储，状态没有更改。",
    quota: "浏览器本地存储空间不足，状态没有更改。",
    "already-completed": "这条信息已经完成，不能再次修改。",
    "invalid-status": "当前状态不允许完成操作。",
    "invalid-transition": "该信息类型不允许切换到此状态。",
    "invalid-type": "信息类型无效，状态没有更改。",
    stale: "记录状态已变化，请返回列表刷新后重试。"
  };
  return messages[reason] || "状态更新失败，信息没有更改，请稍后重试。";
}

function openStatusConfirmation() {
  if (currentPage !== "detail" || statusDialog.open || isStatusUpdating) return;
  const item = window.ShiguangLogic.getItemById(allItems, detailItemId);
  if (!item || !window.ShiguangLogic.canCompleteItem(item, ownedItems())) {
    const feedback = document.querySelector("#detail-status-feedback");
    feedback.textContent = completeStatusError(item ? window.ShiguangLogic.completeItem(item, ownedItems()).reason : "not-found");
    feedback.hidden = false;
    completeItemButton.hidden = true;
    feedback.focus();
    return;
  }
  const targetStatus = window.ShiguangLogic.getCompletedStatus(item);
  document.querySelector("#status-confirm-title").textContent = item.type === "lost" ? "确认物品已找回？" : "确认物品已归还？";
  document.querySelector("#status-confirm-description").textContent = item.type === "lost"
    ? "确认后状态将变为“已找到”，无法撤回。"
    : "确认后状态将变为“已归还”，无法撤回。";
  document.querySelector("#status-confirm-error").textContent = "";
  statusDialogError.hidden = true;
  confirmStatusButton.dataset.nextStatus = targetStatus;
  confirmStatusButton.disabled = false;
  confirmStatusButton.textContent = "确认完成";
  statusDialog.showModal();
  document.body.classList.add("status-modal-open");
  cancelStatusButton.focus();
}

function finishStatusConfirmation(restoreFocus = true) {
  document.body.classList.remove("status-modal-open");
  if (restoreFocus && !completeItemButton.hidden && currentPage === "detail") {
    completeItemButton.focus({ preventScroll: true });
  }
}

function closeStatusConfirmation(restoreFocus = true) {
  if (isStatusUpdating) return;
  if (statusDialog.open) statusDialog.close();
  finishStatusConfirmation(restoreFocus);
}

function confirmStatusUpdate() {
  if (isStatusUpdating || !statusDialog.open) return;
  isStatusUpdating = true;
  confirmStatusButton.disabled = true;
  confirmStatusButton.textContent = "正在保存…";
  confirmStatusButton.setAttribute("aria-busy", "true");
  statusDialogError.hidden = true;

  const item = window.ShiguangLogic.getItemById(allItems, detailItemId);
  const completion = window.ShiguangLogic.completeItem(item, ownedItems());
  if (!completion.ok) {
    isStatusUpdating = false;
    confirmStatusButton.disabled = false;
    confirmStatusButton.textContent = "确认完成";
    confirmStatusButton.setAttribute("aria-busy", "false");
    statusDialogError.textContent = completeStatusError(completion.reason);
    statusDialogError.hidden = false;
    statusDialogError.focus();
    return;
  }

  const saved = window.ShiguangStorage.updateItemStatus(item.id, confirmStatusButton.dataset.nextStatus);
  if (!saved.ok) {
    isStatusUpdating = false;
    confirmStatusButton.disabled = false;
    confirmStatusButton.textContent = "确认完成";
    confirmStatusButton.setAttribute("aria-busy", "false");
    statusDialogError.textContent = completeStatusError(saved.reason);
    statusDialogError.hidden = false;
    statusDialogError.focus();
    return;
  }

  userItems = userItems.map((entry) => entry.id === saved.item.id ? saved.item : entry);
  allItems = [...sampleItems, ...userItems];
  renderItems(currentFilter);
  renderCurrentSearchResults();
  renderMyPosts();
  isStatusUpdating = false;
  confirmStatusButton.setAttribute("aria-busy", "false");
  statusDialog.close();
  finishStatusConfirmation(false);
  openItemDetails(saved.item.id, true);
  const feedback = document.querySelector("#detail-status-feedback");
  feedback.textContent = `状态已更新为“${statusLabels[saved.item.status]}”。`;
  feedback.hidden = false;
  feedback.focus({ preventScroll: true });
}

function currentContact() {
  const item = window.ShiguangLogic.getItemById(allItems, detailItemId);
  return typeof item?.contact === "string" ? item.contact.trim() : "";
}

function openContact() {
  const item = window.ShiguangLogic.getItemById(allItems, detailItemId);
  if (currentPage !== "detail" || contactDialog.open || !item) return;
  const contact = currentContact();
  contactSession += 1;
  contactSessionActive = true;
  isCopying = false;
  contactValue.value = contact;
  document.querySelector("#contact-item").textContent = `物品：${detailText(item.name, "未命名物品")}`;
  contactDialog.setAttribute("aria-describedby", `contact-item contact-hint${contact ? "" : " contact-empty"}`);
  document.querySelector("#contact-type").textContent = /^(?:\+?86[- ]?)?1[3-9]\d{9}$/.test(contact) ? "手机号" : "微信号或其他联系方式";
  document.querySelector("#contact-field").hidden = !contact;
  document.querySelector("#contact-empty").hidden = Boolean(contact);
  copyButton.disabled = !contact;
  copyButton.setAttribute("aria-busy", "false");
  selectContactButton.hidden = !contact;
  copyButton.textContent = "一键复制";
  copyFeedback.textContent = "";
  // 原生模态 dialog 隔离背景的鼠标和键盘操作，且不依赖外部库。
  contactDialog.showModal();
  document.body.classList.add("contact-modal-open");
  closeContactButton.focus();
}

function finishContactClose() {
  if (!contactSessionActive) return;
  contactSessionActive = false;
  contactSession += 1; // 让关闭前尚未完成的复制请求失效。
  isCopying = false;
  contactValue.value = "";
  document.querySelector("#contact-item").textContent = "";
  copyButton.disabled = true;
  copyButton.textContent = "一键复制";
  copyButton.setAttribute("aria-busy", "false");
  selectContactButton.hidden = true;
  copyFeedback.textContent = "";
  document.body.classList.remove("contact-modal-open");
  contactButton.focus({ preventScroll: true });
}

function closeContact() {
  if (contactDialog.open) contactDialog.close();
  finishContactClose();
}

function selectContactText() {
  if (!contactDialog.open || !contactValue.value) return;
  contactValue.focus();
  contactValue.select();
  copyFeedback.textContent = "已选中全部联系方式，请按 Ctrl+C（Mac 上按 Command+C），或长按、右键复制。";
}

async function copyContact() {
  const contact = contactValue.value;
  if (!contactDialog.open || !contact || isCopying) return;
  const session = contactSession;
  isCopying = true;
  // 禁用当前焦点按钮前先移动到只读文本，等待权限确认时仍可用键盘操作。
  if (document.activeElement === copyButton) contactValue.focus();
  copyButton.disabled = true;
  copyButton.setAttribute("aria-busy", "true");
  copyButton.textContent = "正在复制…";
  copyFeedback.textContent = "";
  try {
    const clipboard = window.navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== "function") throw new Error("clipboard-unavailable");
    await clipboard.writeText(contact);
    if (session === contactSession && contactDialog.open) copyFeedback.textContent = "复制成功";
  } catch (_) {
    if (session === contactSession && contactDialog.open) {
      selectContactText();
      copyFeedback.textContent = `自动复制失败或浏览器不支持。${copyFeedback.textContent}`;
    }
  } finally {
    if (session === contactSession && contactDialog.open) {
      isCopying = false;
      copyButton.disabled = !contactValue.value;
      copyButton.setAttribute("aria-busy", "false");
      copyButton.textContent = "一键复制";
    }
  }
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
  let ownerId;
  try {
    ownerId = window.ShiguangStorage.getOwnerId();
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
  currentOwnerId = ownerId;
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

tabs.forEach((button) => {
  button.addEventListener("click", () => selectFilter(button));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = Array.prototype.indexOf.call(tabs, button);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    tabs[nextIndex].focus();
    selectFilter(tabs[nextIndex]);
  });
});
categoryFilter.addEventListener("change", () => {
  updateHomeFilterControlStyles();
  renderItems(currentFilter);
});
locationFilter.addEventListener("input", () => {
  updateHomeFilterControlStyles();
  renderItems(currentFilter);
});
locationFilter.addEventListener("search", () => {
  updateHomeFilterControlStyles();
  renderItems(currentFilter);
});
clearLocationFilter.addEventListener("click", () => {
  locationFilter.value = "";
  updateHomeFilterControlStyles();
  renderItems(currentFilter);
  locationFilter.focus();
});
[document.querySelector("#item-list"), searchResultList, myPostList].forEach((list) => {
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
myPostFilters.forEach((button) => {
  button.addEventListener("click", () => selectMyPostFilter(button));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = Array.prototype.indexOf.call(myPostFilters, button);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? myPostFilters.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : myPostFilters.length - 1)) % myPostFilters.length;
    myPostFilters[nextIndex].focus();
    selectMyPostFilter(myPostFilters[nextIndex]);
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
  } else if (link.dataset.page === "my-posts") showPage("my-posts");
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
  openItemDetails(lastPublishedItem?.id || "");
});
document.querySelector("#detail-back").addEventListener("click", returnFromDetails);
document.querySelector("#detail-home").addEventListener("click", () => showPage("home"));
contactButton.addEventListener("click", openContact);
completeItemButton.addEventListener("click", openStatusConfirmation);
confirmStatusButton.addEventListener("click", confirmStatusUpdate);
cancelStatusButton.addEventListener("click", () => closeStatusConfirmation());
document.querySelector("#close-status-confirm").addEventListener("click", () => closeStatusConfirmation());
statusDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeStatusConfirmation(); });
statusDialog.addEventListener("close", () => finishStatusConfirmation());
statusDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !event.isComposing) {
    event.preventDefault();
    closeStatusConfirmation();
  } else if (event.key === "Tab") {
    const focusable = [document.querySelector("#close-status-confirm"), cancelStatusButton, ...(!confirmStatusButton.disabled ? [confirmStatusButton] : [])];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!focusable.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
copyButton.addEventListener("click", copyContact);
selectContactButton.addEventListener("click", selectContactText);
closeContactButton.addEventListener("click", closeContact);
contactDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeContact(); });
contactDialog.addEventListener("close", () => { if (!contactDialog.open) finishContactClose(); });
contactDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !event.isComposing) {
    event.preventDefault();
    closeContact();
  } else if (event.key === "Tab") {
    const focusable = [closeContactButton, ...(!contactValue.value ? [] : [contactValue, selectContactButton]), ...(!copyButton.disabled ? [copyButton] : [])];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!focusable.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
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
updateHomeFilterControlStyles();
renderItems(currentFilter);
setMode("lost");
window.addEventListener("hashchange", () => restoreDetailAddress());
restoreDetailAddress(true);
