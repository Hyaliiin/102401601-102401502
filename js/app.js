"use strict";

const demoItems = [
  { id: "item-001", name: "蓝色水杯", icon: "🥤", type: "lost", typeLabel: "寻物", location: "图书馆二楼", time: "今天 09:20", publishedAt: "2026-10-09T09:20:00+08:00", status: "寻找中" },
  { id: "item-002", name: "一串钥匙", icon: "🔑", type: "found", typeLabel: "招领", location: "第一食堂门口", time: "昨天 18:10", publishedAt: "2026-10-08T18:10:00+08:00", status: "待认领" },
  { id: "item-003", name: "黑色折叠伞", icon: "☂️", type: "found", typeLabel: "招领", location: "教学楼一楼", time: "10月7日 12:30", publishedAt: "2026-10-07T12:30:00+08:00", status: "已归还" }
];
const filterLabels = { lost: "寻物信息", found: "招领信息", latest: "最新发布" };

function getVisibleItems(filter) {
  const items = filter === "latest" ? [...demoItems] : demoItems.filter((item) => item.type === filter);
  return items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function createItemCard(item) {
  const completedClass = item.status === "已归还" ? " completed" : "";
  return `<article class="item-card" tabindex="0" data-item-id="${item.id}" aria-label="查看${item.name}详情">
    <div class="card-top"><span class="type-label">${item.typeLabel}</span><span class="status-label${completedClass}">${item.status}</span></div>
    <div class="card-title-row"><span class="item-icon" aria-hidden="true">${item.icon}</span><h3 class="card-title">${item.name}</h3></div>
    <p class="card-location">📍 ${item.location}</p>
    <div class="card-meta"><span>发布于 ${item.time}</span><span>查看详情 ›</span></div>
  </article>`;
}

function renderItems(filter) {
  const list = document.querySelector("#item-list");
  const items = getVisibleItems(filter);
  document.querySelector("#result-count").textContent = `${items.length} 条信息`;
  list.innerHTML = items.length ? items.map(createItemCard).join("") : `<div class="empty-state"><strong>暂时没有${filterLabels[filter]}记录</strong><span>有新的信息时，会第一时间出现在这里。</span></div>`;
}

function selectFilter(button) {
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    const selected = tab === button;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  renderItems(button.dataset.filter);
}

function showItemFeedback(card) {
  const item = demoItems.find((entry) => entry.id === card.dataset.itemId);
  if (item) alert(`已选择“${item.name}”，详情页面将在后续阶段开放。`);
}

document.querySelectorAll(".filter-tab").forEach((button) => button.addEventListener("click", () => selectFilter(button)));
document.querySelector("#item-list").addEventListener("click", (event) => {
  const card = event.target.closest(".item-card");
  if (card) showItemFeedback(card);
});
document.querySelector("#item-list").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") showItemFeedback(event.target);
});
document.querySelector("#search-entry").addEventListener("click", () => alert("搜索功能将在后续阶段开放。"));
renderItems("lost");
