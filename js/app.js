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
  publish: document.querySelector("#publish-view"),
  success: document.querySelector("#success-view")
};
const headerTitle = document.querySelector("#header-title");
const headerSubtitle = document.querySelector("#header-subtitle");
const searchButton = document.querySelector("#search-entry");
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
const storageResult = window.ShiguangStorage.loadItems();
let userItems = storageResult.ok ? storageResult.items : [];
let allItems = [...sampleItems, ...userItems];
let currentFilter = "lost";
let currentMode = "lost";
let isSubmitting = false;
let lastPublishedItem = null;

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function createItemCard(item) {
  const card = document.createElement("article");
  card.className = "item-card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.dataset.itemId = item.id;
  card.setAttribute("aria-label", `查看${item.name}详情`);

  const top = document.createElement("div");
  top.className = "card-top";
  top.append(textElement("span", "type-label", typeLabels[item.type] || "信息"));
  const status = textElement("span", `status-label${["returned", "recovered"].includes(item.status) ? " completed" : ""}`, statusLabels[item.status] || "状态未知");
  top.append(status);

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";
  const icon = textElement("span", "item-icon", itemIcons[item.category] || itemIcons["其他"]);
  icon.setAttribute("aria-hidden", "true");
  titleRow.append(icon, textElement("h3", "card-title", item.name));

  const location = textElement("p", "card-location", `📍 ${item.location}`);
  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.append(textElement("span", "", `发布于 ${formatPublishedAt(item.publishedAt)}`));
  meta.append(textElement("span", "", "查看详情 ›"));
  card.append(top, titleRow, location, meta);
  return card;
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
  const feedback = document.querySelector("#interaction-feedback");
  feedback.textContent = `已选择“${item.name}”，详情页面将在后续阶段开放。`;
  card.classList.add("is-selected");
  window.setTimeout(() => card.classList.remove("is-selected"), 700);
}

function showPage(page) {
  const visiblePage = page === "success" ? "success" : page;
  Object.entries(viewElements).forEach(([name, element]) => { element.hidden = name !== visiblePage; });
  const onPublish = page === "publish" || page === "success";
  headerTitle.textContent = onPublish ? (page === "success" ? "发布成功" : "发布信息") : "拾光";
  headerSubtitle.textContent = onPublish ? "让线索留下，让物品回家" : "校园失物招领";
  searchButton.hidden = onPublish;
  homeNav.classList.toggle("active", page === "home");
  publishNav.classList.toggle("active", onPublish);
  if (page === "home") {
    homeNav.setAttribute("aria-current", "page");
    publishNav.removeAttribute("aria-current");
  } else {
    publishNav.setAttribute("aria-current", "page");
    homeNav.removeAttribute("aria-current");
  }
  if (page === "home") document.querySelector("#items-title").focus?.();
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
  formError.hidden = true;
  formError.textContent = "";
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

function showValidationErrors(errors) {
  formError.textContent = Object.values(errors).join("；");
  formError.hidden = false;
  const firstInvalid = Object.keys(errors)[0];
  const fieldMap = { name: "#item-name", category: "#item-category", location: "#item-location", eventAt: "#event-time", description: "#item-description", contact: "#item-contact" };
  document.querySelector(fieldMap[firstInvalid])?.focus();
}

function resetForm() {
  form.reset();
  isSubmitting = false;
  submitButton.disabled = false;
  submitButton.textContent = "发布信息";
  formError.hidden = true;
  formError.textContent = "";
  formInfo.hidden = true;
  formInfo.textContent = "";
  setMode("lost");
}

function handlePublish(event) {
  event.preventDefault();
  if (isSubmitting) return;
  formError.hidden = true;
  const values = formValues();
  const validation = window.ShiguangLogic.validate(values);
  if (!validation.valid) {
    showValidationErrors(validation.errors);
    return;
  }

  isSubmitting = true;
  submitButton.disabled = true;
  submitButton.textContent = "正在保存…";
  try {
    const ownerId = window.ShiguangStorage.getOwnerId();
    let id = window.ShiguangStorage.createId("item");
    const existingIds = new Set(allItems.map((item) => item.id));
    while (existingIds.has(id)) id = window.ShiguangStorage.createId("item");
    const item = window.ShiguangLogic.createItem(values, ownerId, id, new Date().toISOString());
    const result = window.ShiguangStorage.saveItem(item);
    if (!result.ok) {
      isSubmitting = false;
      submitButton.disabled = false;
      submitButton.textContent = "发布信息";
      formError.textContent = result.reason === "duplicate" ? "记录编号冲突，请重新提交。" : "当前浏览器无法保存本地数据，请检查浏览器存储设置后重试。";
      formError.hidden = false;
      return;
    }
    lastPublishedItem = item;
    userItems = [...userItems, item];
    allItems = [...sampleItems, ...userItems];
    document.querySelector("#success-item-name").textContent = item.name;
    document.querySelector("#success-status").textContent = statusLabels[item.status];
    document.querySelector("#success-action-feedback").hidden = true;
    showPage("success");
  } catch (_) {
    isSubmitting = false;
    submitButton.disabled = false;
    submitButton.textContent = "发布信息";
    formError.textContent = "当前浏览器无法访问本地存储，信息未发布。请检查浏览器设置后重试。";
    formError.hidden = false;
  }
}

tabs.forEach((button) => button.addEventListener("click", () => selectFilter(button)));
document.querySelector("#item-list").addEventListener("click", (event) => {
  const card = event.target.closest(".item-card");
  if (card) showItemFeedback(card);
});
document.querySelector("#item-list").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".item-card");
  if (!card) return;
  event.preventDefault();
  showItemFeedback(card);
});
modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
form.addEventListener("submit", handlePublish);

document.querySelectorAll(".nav-item").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  if (link.dataset.page === "home") showPage("home");
  else if (link.dataset.page === "publish") {
    if (!viewElements.success.hidden) resetForm();
    showPage("publish");
  }
  else {
    formInfo.textContent = "我的发布管理将在后续阶段开放。";
    formInfo.hidden = false;
    showPage("publish");
  }
}));

searchButton.addEventListener("click", () => {
  document.querySelector("#interaction-feedback").textContent = "搜索功能将在后续阶段开放。";
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
  formInfo.textContent = "当前浏览器无法读取本地发布信息；示例内容仍可查看，但发布内容可能无法保存。";
  formInfo.hidden = false;
}
renderItems(currentFilter);
setMode("lost");
