const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createApp, fillRequiredForm, root } = require("./helpers/app-fixture");

const itemsKey = "shiguang.items.v1";
function record(overrides = {}) {
  return { id: "user-a", type: "lost", name: "用户的水杯", category: "水杯", location: "图书馆",
    eventAt: "2026-10-08T10:00:00+08:00", description: "有贴纸", contact: "wx_test",
    status: "searching", publishedAt: "2026-10-09T09:00:00+08:00", ownerId: "local-owner", ...overrides };
}
function storedApp(records = [record()], options = {}) {
  return createApp(new Map([[itemsKey, JSON.stringify(records)]]), options);
}
function clickCard(app, id, listId = "item-list") {
  const list = app.elements[listId];
  const card = list.children.find((element) => element.dataset.itemId === id);
  assert.ok(card, "入口卡片存在");
  list.dispatch("click", { target: card });
  return card;
}
function openContact(app) { app.elements["view-contact"].dispatch("click"); }
function closeContact(app) { app.elements["close-contact"].dispatch("click"); }
function logic() { return createApp().context.window.ShiguangLogic; }

test("详情按严格字符串 ID 获取，不依赖数组顺序或数字转换", () => {
  const { getItemById } = logic();
  const first = record({ id: "1" });
  const second = record({ id: "2" });
  assert.equal(getItemById([second, first], "1"), first);
  assert.equal(getItemById([first, second], "2"), second);
  assert.equal(getItemById([first], 1), null);
  assert.equal(getItemById([first], " 1 "), null);
});

test("不存在、空白或异常 ID 及无效集合返回明确空结果", () => {
  const { getItemById } = logic();
  for (const id of ["missing", "", " ", null, undefined, {}, [], 0]) {
    assert.equal(getItemById([record()], id), null);
  }
  for (const records of [null, undefined, {}, "items", 3]) {
    assert.equal(getItemById(records, "user-a"), null);
  }
});

test("详情查询忽略异常成员，允许显示字段缺失的合法 ID 记录", () => {
  const { getItemById } = logic();
  const partial = { id: "partial", contact: null };
  assert.equal(getItemById([null, 4, [], "text", { id: 1 }, partial], "partial"), partial);
  assert.equal(getItemById([null, 4, [], "text", { id: 1 }], "1"), null);
});

test("查询不修改冻结的原始数组及记录", () => {
  const { getItemById } = logic();
  const records = Object.freeze([Object.freeze(record()), Object.freeze(record({ id: "b" }))]);
  const before = JSON.stringify(records);
  assert.equal(getItemById(records, "b"), records[1]);
  assert.equal(JSON.stringify(records), before);
});

test("首页示例卡片进入详情，展示类别、地点、时间与描述", () => {
  const app = createApp();
  clickCard(app, "item-001");
  const { elements, context } = app;
  assert.equal(elements["detail-view"].hidden, false);
  assert.equal(elements["home-view"].hidden, true);
  assert.equal(elements["detail-name"].textContent, "蓝色水杯");
  assert.equal(elements["detail-category"].textContent, "水杯");
  assert.equal(elements["detail-icon"].textContent, "🥤");
  assert.equal(elements["detail-location"].textContent, "图书馆二楼");
  assert.equal(elements["detail-location-label"].textContent, "丢失地点");
  assert.equal(elements["detail-time-label"].textContent, "丢失时间");
  assert.match(elements["detail-time"].textContent, /2026/);
  assert.match(elements["detail-published"].textContent, /发布于/);
  assert.equal(elements["detail-description"].textContent, "蓝色随行水杯。");
  assert.equal(elements["detail-status"].textContent, "寻找中");
  assert.equal(context.window.location.hash, "#item=item-001");
  assert.equal(context.document.activeElement, elements["detail-title"]);
});

test("招领详情使用拾取字段、正确物品及完成状态", () => {
  const app = createApp();
  app.filters[1].dispatch("click");
  clickCard(app, "item-003");
  assert.equal(app.elements["detail-name"].textContent, "黑色折叠伞");
  assert.equal(app.elements["detail-type"].textContent, "招领");
  assert.equal(app.elements["detail-location-label"].textContent, "拾取地点");
  assert.equal(app.elements["detail-time-label"].textContent, "拾取时间");
  assert.equal(app.elements["detail-status"].textContent, "已归还");
  assert.ok(app.elements["detail-status"].classes.has("completed"));
  app.elements["detail-back"].dispatch("click");
  assert.equal(app.filters[1].attributes["aria-selected"], "true");
  assert.equal(app.elements["item-list"].children.length, 2);
});

test("发布成功页进入新物品详情，返回后不解除重复提交保护", () => {
  const app = createApp();
  app.nav[1].dispatch("click");
  fillRequiredForm(app.elements);
  app.modes[1].dispatch("click");
  app.elements["publish-form"].dispatch("submit");
  const saved = JSON.parse(app.sharedStorage.get(itemsKey))[0];
  app.elements["view-details"].dispatch("click");
  assert.equal(app.context.window.ShiguangApp.getSelectedItemId(), saved.id);
  assert.equal(app.context.window.ShiguangApp.getItemById(saved.id).contact, saved.contact);
  assert.equal(app.elements["detail-name"].textContent, saved.name);
  assert.equal(app.elements["detail-status"].textContent, "待认领");
  openContact(app);
  assert.equal(app.elements["contact-value"].value, saved.contact);
  closeContact(app);
  app.elements["detail-back"].dispatch("click");
  assert.equal(app.elements["success-view"].hidden, false);
  assert.equal(app.context.document.activeElement, app.elements["view-details"]);
  app.elements["publish-form"].dispatch("submit");
  assert.equal(JSON.parse(app.sharedStorage.get(itemsKey)).length, 1);
});

test("搜索结果进入详情再返回保留关键词、排序、数量、卡片与滚动位置", () => {
  const app = storedApp();
  const { elements, context } = app;
  app.filters[1].dispatch("click");
  elements["search-entry"].dispatch("click");
  elements["search-keyword"].value = "水杯";
  elements["search-form"].dispatch("submit");
  const cards = elements["search-result-list"].children;
  const summary = elements["search-summary"].textContent;
  elements["app-content"].scrollTop = 123;
  context.window.scrollY = 45;
  const card = clickCard(app, "user-a", "search-result-list");
  elements["detail-back"].dispatch("click");
  assert.equal(elements["search-view"].hidden, false);
  assert.equal(elements["search-keyword"].value, "水杯");
  assert.equal(elements["search-summary"].textContent, summary);
  assert.equal(elements["search-result-list"].children, cards);
  assert.equal(context.document.activeElement, card);
  assert.equal(elements["app-content"].scrollTop, 123);
  assert.equal(context.window.scrollY, 45);
  elements["search-back"].dispatch("click");
  assert.equal(app.filters[1].attributes["aria-selected"], "true");
});

test("详情可经示例或持久化用户 ID 地址刷新恢复，返回默认首页", () => {
  for (const id of ["item-001", "user-a"]) {
    const app = storedApp();
    clickCard(app, id);
    const refreshed = createApp(app.sharedStorage, { hash: app.context.window.location.hash });
    assert.equal(refreshed.elements["detail-view"].hidden, false);
    assert.equal(refreshed.context.window.ShiguangApp.getSelectedItemId(), id);
    refreshed.elements["detail-back"].dispatch("click");
    assert.equal(refreshed.elements["home-view"].hidden, false);
    assert.equal(refreshed.context.window.location.hash, "#home");
  }
});

test("含特殊字符的 ID 编码后仍能准确恢复且地址不含联系方式", () => {
  const id = "本地/#?物品&一";
  const app = storedApp([record({ id })]);
  clickCard(app, id);
  const hash = app.context.window.location.hash;
  assert.equal(hash, "#item=" + encodeURIComponent(id));
  assert.ok(!hash.includes("wx_test"));
  const refreshed = createApp(app.sharedStorage, { hash });
  assert.equal(refreshed.context.window.ShiguangApp.getSelectedItemId(), id);
});

test("错误 ID、缺失记录与损坏的地址编码显示空状态并可返回首页", () => {
  for (const hash of ["#item=missing", "#item=", "#item=%E0%A4%A"]) {
    const app = createApp(new Map(), { hash });
    assert.equal(app.elements["detail-missing"].hidden, false);
    assert.equal(app.elements["detail-content"].hidden, true);
    assert.equal(app.elements["view-contact"].hidden, true);
    assert.equal(app.context.window.ShiguangApp.getSelectedItemId(), null);
    app.elements["detail-home"].dispatch("click");
    assert.equal(app.elements["home-view"].hidden, false);
  }
});

test("本地 JSON 损坏时给出详情警告且不覆盖原数据，示例仍可打开", () => {
  const raw = "{broken";
  const shared = new Map([[itemsKey, raw]]);
  const app = createApp(shared, { hash: "#item=user-a" });
  assert.equal(app.elements["detail-missing"].hidden, false);
  assert.equal(app.elements["detail-storage-warning"].hidden, false);
  assert.match(app.elements["detail-storage-warning"].textContent, /未被覆盖/);
  assert.equal(shared.get(itemsKey), raw);
  const sample = createApp(shared, { hash: "#item=item-001" });
  assert.equal(sample.elements["detail-content"].hidden, false);
  assert.equal(shared.get(itemsKey), raw);
});

test("localStorage 不可访问时详情恢复不会崩溃", () => {
  const localStorage = { getItem() { throw new Error("blocked"); } };
  const app = createApp(new Map(), { localStorage, hash: "#item=user-a" });
  assert.equal(app.elements["detail-missing"].hidden, false);
  assert.equal(app.elements["detail-storage-warning"].hidden, false);
});

test("缺失、空白、原型同名和异常类型字段安全回退", () => {
  const app = createApp();
  vm.runInContext('allItems = [{id:"partial",name:null,location:{},category:"toString",status:"__proto__",type:[],eventAt:"invalid",publishedAt:null,description:"   ",contact:4}]', app.context);
  app.elements["search-entry"].dispatch("click");
  app.elements["search-keyword"].value = "toString";
  app.elements["search-form"].dispatch("submit");
  clickCard(app, "partial", "search-result-list");
  assert.equal(app.elements["detail-name"].textContent, "未命名物品");
  assert.equal(app.elements["detail-location"].textContent, "地点未提供");
  assert.equal(app.elements["detail-status"].textContent, "状态未知");
  assert.equal(app.elements["detail-icon"].textContent, "📦");
  assert.equal(app.elements["detail-time"].textContent, "时间未知");
  assert.equal(app.elements["detail-description"].textContent, "暂无物品描述。");
  openContact(app);
  assert.equal(app.elements["contact-empty"].hidden, false);
  assert.equal(app.elements["copy-contact"].disabled, true);
});

test("HTML 特殊字符只按文本展示，不创建可执行 DOM", () => {
  const payload = '<img src=x onerror="alert(1)"> & </textarea><script>x</script>';
  const app = storedApp([record({ name: payload, location: payload, description: payload, contact: payload })]);
  clickCard(app, "user-a");
  for (const id of ["detail-name", "detail-location", "detail-description"]) {
    assert.equal(app.elements[id].textContent, payload);
    assert.equal(app.elements[id].children.length, 0);
  }
  openContact(app);
  assert.equal(app.elements["contact-value"].value, payload);
  assert.equal(app.elements["contact-value"].children.length, 0);
});

test("不同物品的联系方式严格对应 ID，关闭后清空旧联系方式", () => {
  const app = storedApp([record(), record({ id: "user-b", contact: "13800138000" })]);
  clickCard(app, "user-a");
  openContact(app);
  assert.equal(app.elements["contact-value"].value, "wx_test");
  assert.match(app.elements["contact-type"].textContent, /微信/);
  closeContact(app);
  assert.equal(app.elements["contact-value"].value, "");
  app.elements["detail-back"].dispatch("click");
  clickCard(app, "user-b");
  openContact(app);
  assert.equal(app.elements["contact-value"].value, "13800138000");
  assert.equal(app.elements["contact-type"].textContent, "手机号");
});

test("空联系方式有友好提示且不能复制，不残留其他物品内容", async () => {
  let writes = 0;
  const app = storedApp([record()], { clipboard: { async writeText() { writes += 1; } } });
  clickCard(app, "user-a");
  openContact(app);
  closeContact(app);
  app.elements["detail-back"].dispatch("click");
  clickCard(app, "item-001");
  openContact(app);
  assert.equal(app.elements["contact-field"].hidden, true);
  assert.equal(app.elements["contact-empty"].hidden, false);
  assert.equal(app.elements["contact-value"].value, "");
  assert.equal(app.elements["copy-contact"].disabled, true);
  await app.elements["copy-contact"].handlers.click();
  assert.equal(writes, 0);
});

test("已找回和已归还状态显示正确，换为进行中时清除完成样式", () => {
  const app = storedApp([record({ status: "recovered" })]);
  clickCard(app, "user-a");
  assert.equal(app.elements["detail-status"].textContent, "已找回");
  assert.ok(app.elements["detail-status"].classes.has("completed"));
  app.elements["detail-back"].dispatch("click");
  clickCard(app, "item-001");
  assert.equal(app.elements["detail-status"].textContent, "寻找中");
  assert.ok(!app.elements["detail-status"].classes.has("completed"));
});

test("复制仅在 API 实际成功后提示成功，并阻止等待期间重复复制", async () => {
  let resolveCopy;
  const written = [];
  const app = storedApp([record()], { clipboard: { writeText(value) {
    written.push(value);
    return new Promise((resolve) => { resolveCopy = resolve; });
  } } });
  clickCard(app, "user-a");
  openContact(app);
  const pending = app.elements["copy-contact"].handlers.click();
  assert.equal(app.elements["copy-contact"].disabled, true);
  assert.equal(app.elements["copy-feedback"].textContent, "");
  await app.elements["copy-contact"].handlers.click();
  assert.deepEqual(written, ["wx_test"]);
  resolveCopy();
  await pending;
  assert.equal(app.elements["copy-feedback"].textContent, "复制成功");
  assert.equal(app.elements["copy-contact"].disabled, false);
});

test("复制被拒绝时给出手动复制提示，并聚焦选中完整文本", async () => {
  const app = storedApp([record()], { clipboard: { async writeText() { throw new Error("denied"); } } });
  clickCard(app, "user-a");
  openContact(app);
  await app.elements["copy-contact"].handlers.click();
  assert.match(app.elements["copy-feedback"].textContent, /自动复制失败/);
  assert.ok(!app.elements["copy-feedback"].textContent.includes("复制成功"));
  assert.equal(app.context.document.activeElement, app.elements["contact-value"]);
  assert.equal(app.elements["contact-value"].selectionEnd, "wx_test".length);
  assert.equal(app.elements["copy-contact"].disabled, false);
});

test("Clipboard API 不存在或访问抛错时仍提供手动复制", async () => {
  for (const blocked of [false, true]) {
    const app = storedApp();
    if (blocked) Object.defineProperty(app.context.window.navigator, "clipboard", { get() { throw new Error("blocked"); } });
    clickCard(app, "user-a");
    openContact(app);
    await app.elements["copy-contact"].handlers.click();
    assert.match(app.elements["copy-feedback"].textContent, /Ctrl\+C/);
    assert.equal(app.elements["contact-value"].selectionStart, 0);
    assert.equal(app.elements["contact-value"].value, "wx_test");
  }
});

test("弹窗使用模态 API，关闭按钮、Esc 和原生 cancel 均恢复触发焦点", () => {
  const app = storedApp();
  clickCard(app, "user-a");
  const { elements, context } = app;
  for (const close of [
    () => closeContact(app),
    () => elements["contact-dialog"].dispatch("keydown", { key: "Escape" }),
    () => elements["contact-dialog"].dispatch("cancel"),
    () => elements["contact-dialog"].close()
  ]) {
    openContact(app);
    assert.equal(elements["contact-dialog"].modal, true);
    assert.equal(context.document.activeElement, elements["close-contact"]);
    assert.ok(context.document.body.classes.has("contact-modal-open"));
    close();
    assert.equal(elements["contact-dialog"].open, false);
    assert.equal(context.document.activeElement, elements["view-contact"]);
    assert.ok(!context.document.body.classes.has("contact-modal-open"));
  }
});

test("弹窗 Tab 和 Shift+Tab 限制在可用控件中，空联系方式也可关闭", () => {
  const app = storedApp();
  clickCard(app, "user-a");
  openContact(app);
  const { elements, context } = app;
  elements["contact-dialog"].dispatch("keydown", { key: "Tab", shiftKey: true });
  assert.equal(context.document.activeElement, elements["copy-contact"]);
  elements["contact-dialog"].dispatch("keydown", { key: "Tab" });
  assert.equal(context.document.activeElement, elements["close-contact"]);
  closeContact(app);
  elements["detail-back"].dispatch("click");
  clickCard(app, "item-001");
  openContact(app);
  assert.equal(elements["contact-dialog"].dispatch("keydown", { key: "Tab" }).defaultPrevented, true);
  assert.equal(context.document.activeElement, elements["close-contact"]);
});

test("旧弹窗未完成的复制不会污染重新打开后的提示、文本或锁", async () => {
  let finish;
  const app = storedApp([record()], { clipboard: { writeText() { return new Promise((resolve) => { finish = resolve; }); } } });
  clickCard(app, "user-a");
  openContact(app);
  const pending = app.elements["copy-contact"].handlers.click();
  closeContact(app);
  app.elements["detail-back"].dispatch("click");
  clickCard(app, "item-001");
  openContact(app);
  finish();
  await pending;
  assert.equal(app.elements["copy-feedback"].textContent, "");
  assert.equal(app.elements["contact-value"].value, "");
  assert.equal(app.elements["copy-contact"].disabled, true);
});

test("快速重复点击卡片不会丢失原返回页或产生重复记录", () => {
  const app = storedApp();
  const before = app.sharedStorage.get(itemsKey);
  const card = clickCard(app, "user-a");
  for (let i = 0; i < 5; i += 1) app.elements["item-list"].dispatch("click", { target: card });
  app.elements["detail-back"].dispatch("click");
  assert.equal(app.elements["home-view"].hidden, false);
  assert.equal(app.context.document.activeElement.dataset.itemId, "user-a");
  assert.equal(app.sharedStorage.get(itemsKey), before);
});

test("首页和搜索卡片保留 Enter、空格进入详情的能力", () => {
  for (const key of ["Enter", " "]) {
    const app = createApp();
    const list = app.elements["item-list"];
    const event = list.dispatch("keydown", { key, target: list.children[0] });
    assert.equal(event.defaultPrevented, true);
    assert.equal(app.elements["detail-view"].hidden, false);
    app.elements["detail-back"].dispatch("click");
    app.elements["search-entry"].dispatch("click");
    app.elements["search-keyword"].value = "钥匙";
    app.elements["search-form"].dispatch("submit");
    const results = app.elements["search-result-list"];
    results.dispatch("keydown", { key, target: results.children[0] });
    assert.equal(app.elements["detail-name"].textContent, "一串钥匙");
  }
});

test("离开详情清除恢复地址及模态滚动锁，不影响底部导航", () => {
  const app = storedApp();
  clickCard(app, "user-a");
  openContact(app);
  // 防御性模拟程序导航；真实 modal 打开时背景导航不可点击。
  app.nav[1].dispatch("click");
  assert.equal(app.elements["publish-view"].hidden, false);
  assert.equal(app.context.window.location.hash, "#home");
  assert.equal(app.elements["contact-dialog"].open, false);
  assert.ok(!app.context.document.body.classes.has("contact-modal-open"));
  assert.equal(app.context.document.activeElement, app.elements["publish-title"]);
});

test("详情标记含原生 dialog、只读文本和无障碍关联，脚本仍为本地普通脚本", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "页面 ID 不重复");
  assert.match(html, /<dialog id="contact-dialog"[^>]*aria-labelledby="contact-title"/);
  assert.match(html, /<textarea id="contact-value"[^>]*readonly/);
  assert.match(html, /id="view-contact"[^>]*aria-haspopup="dialog"/);
  assert.ok(!html.includes('type="module"'));
  const scripts = Array.from(html.matchAll(/<script src="([^"]+)"/g), (match) => match[1]);
  assert.deepEqual(scripts, ["js/logic.js", "js/storage.js", "js/app.js"]);
  scripts.forEach((file) => assert.ok(fs.existsSync(path.join(root, file))));
});

function changeAddress(app, hash) {
  app.context.window.location.hash = hash;
  app.context.window.dispatchEvent({ type: "hashchange" });
}

test("从详情返回搜索移除过期选择提示，重复往返不累积提示或重建结果", () => {
  const app = storedApp();
  const { elements } = app;
  elements["search-entry"].dispatch("click");
  elements["search-keyword"].value = "水杯";
  elements["search-form"].dispatch("submit");
  const cards = elements["search-result-list"].children;
  for (const id of ["user-a", "item-001", "user-a"]) {
    clickCard(app, id, "search-result-list");
    assert.equal(elements["search-feedback"].hidden, false);
    elements["detail-back"].dispatch("click");
    assert.equal(elements["search-feedback"].hidden, true);
    assert.equal(elements["search-feedback"].textContent, "");
    assert.equal(elements["search-result-list"].children, cards);
    assert.equal(app.context.document.activeElement.dataset.itemId, id);
  }
});

test("地址 ID 切换立即更新详情并关闭旧弹窗，联系方式不会串项", () => {
  const app = storedApp([record(), record({ id: "user-b", name: "另一件物品", contact: "test-b" })]);
  clickCard(app, "user-a");
  openContact(app);
  changeAddress(app, "#item=user-b");
  assert.equal(app.elements["contact-dialog"].open, false);
  assert.equal(app.elements["contact-value"].value, "");
  assert.equal(app.elements["detail-name"].textContent, "另一件物品");
  assert.equal(app.context.window.ShiguangApp.getSelectedItemId(), "user-b");
  openContact(app);
  assert.ok(app.elements["contact-value"].value === "test-b");
  assert.equal(app.elements["contact-item"].textContent, "物品：另一件物品");
});

test("搜索页经地址进入详情及浏览器片段返回仍保留原结果、滚动与焦点", () => {
  const app = storedApp();
  const { elements, context } = app;
  elements["search-entry"].dispatch("click");
  elements["search-keyword"].value = "水杯";
  elements["search-form"].dispatch("submit");
  const cards = elements["search-result-list"].children;
  const card = cards.find((item) => item.dataset.itemId === "user-a");
  elements["app-content"].scrollTop = 180;
  context.window.scrollY = 90;
  changeAddress(app, "#item=user-a");
  changeAddress(app, "#item=item-001");
  changeAddress(app, "#home");
  assert.equal(elements["search-view"].hidden, false);
  assert.equal(elements["search-keyword"].value, "水杯");
  assert.equal(elements["search-result-list"].children, cards);
  assert.equal(elements["app-content"].scrollTop, 180);
  assert.equal(context.window.scrollY, 90);
  assert.equal(context.document.activeElement, card);
});

test("地址特殊 ID 切换后刷新仍对应原记录", () => {
  const id = "详情/一?&%#";
  const app = storedApp([record({ id })]);
  changeAddress(app, `#item=${encodeURIComponent(id)}`);
  const refreshed = createApp(app.sharedStorage, { hash: app.context.window.location.hash });
  assert.equal(refreshed.context.window.ShiguangApp.getSelectedItemId(), id);
  assert.equal(refreshed.elements["detail-name"].textContent, "用户的水杯");
});

test("相同地址通知不重新打开详情或关闭正在使用的弹窗", () => {
  const app = storedApp();
  clickCard(app, "user-a");
  openContact(app);
  changeAddress(app, "#item=user-a");
  assert.equal(app.elements["contact-dialog"].open, true);
  assert.equal(app.context.document.activeElement, app.elements["close-contact"]);
});

test("地址变为无效 ID 时聚焦友好说明，旧联系方式不可再次打开", () => {
  for (const hash of ["#item=missing", "#item=%E0%A4%A", "#item="]) {
    const app = storedApp();
    clickCard(app, "user-a");
    openContact(app);
    changeAddress(app, hash);
    assert.equal(app.elements["detail-missing"].hidden, false);
    assert.equal(app.context.document.activeElement, app.elements["detail-missing-title"]);
    assert.equal(app.elements["contact-value"].value, "");
    openContact(app);
    assert.equal(app.elements["contact-dialog"].open, false);
    app.elements["detail-back"].dispatch("click");
    assert.equal(app.elements["home-view"].hidden, false);
  }
});

test("复制等待时焦点仍在弹窗且保留手动复制入口和忙碌状态", async () => {
  let finish;
  const app = storedApp([record()], { clipboard: { writeText() { return new Promise((resolve) => { finish = resolve; }); } } });
  clickCard(app, "user-a");
  openContact(app);
  const { elements, context } = app;
  elements["copy-contact"].focus();
  const pending = elements["copy-contact"].handlers.click();
  assert.equal(context.document.activeElement, elements["contact-value"]);
  assert.equal(elements["copy-contact"].attributes["aria-busy"], "true");
  elements["close-contact"].focus();
  elements["contact-dialog"].dispatch("keydown", { key: "Tab", shiftKey: true });
  assert.equal(context.document.activeElement, elements["select-contact"]);
  elements["contact-dialog"].dispatch("keydown", { key: "Tab" });
  assert.equal(context.document.activeElement, elements["close-contact"]);
  finish();
  await pending;
  assert.equal(elements["copy-contact"].attributes["aria-busy"], "false");
});

test("焦点意外落在弹窗自身时 Tab 与 Shift+Tab 恢复到可用控件", () => {
  const app = storedApp();
  clickCard(app, "user-a");
  openContact(app);
  for (const shiftKey of [false, true]) {
    app.elements["contact-dialog"].focus();
    const event = app.elements["contact-dialog"].dispatch("keydown", { key: "Tab", shiftKey });
    assert.ok(event.defaultPrevented);
    assert.equal(app.context.document.activeElement, app.elements[shiftKey ? "copy-contact" : "close-contact"]);
  }
});

test("手动复制可直接选择全部特殊字符且不会调用 API 或谎报成功", () => {
  let writes = 0;
  const contact = '<>&"\' 测试\n第二行';
  const app = storedApp([record({ contact })], { clipboard: { async writeText() { writes += 1; } } });
  clickCard(app, "user-a");
  openContact(app);
  app.elements["select-contact"].dispatch("click");
  assert.equal(writes, 0);
  assert.equal(app.context.document.activeElement, app.elements["contact-value"]);
  assert.equal(app.elements["contact-value"].selectionStart, 0);
  assert.equal(app.elements["contact-value"].selectionEnd, contact.length);
  assert.match(app.elements["copy-feedback"].textContent, /已选中全部.*长按/);
  assert.ok(!app.elements["copy-feedback"].textContent.includes("复制成功"));
});

test("空白或异常联系方式隐藏手动入口，弹窗描述包含空状态说明", () => {
  for (const contact of [" \t　", null, 42, {}]) {
    const app = storedApp();
    app.context.window.ShiguangApp.getItemById("user-a").contact = contact;
    clickCard(app, "user-a");
    openContact(app);
    assert.equal(app.elements["select-contact"].hidden, true);
    assert.match(app.elements["contact-dialog"].attributes["aria-describedby"], /contact-empty/);
    app.elements["select-contact"].dispatch("click");
    assert.equal(app.elements["copy-feedback"].textContent, "");
  }
});

test("旧复制请求失败不移动新弹窗焦点或解除新请求的忙碌状态", async () => {
  const requests = [];
  const app = storedApp([record()], { clipboard: { writeText() { return new Promise((resolve, reject) => requests.push({ resolve, reject })); } } });
  clickCard(app, "user-a");
  openContact(app);
  const first = app.elements["copy-contact"].handlers.click();
  closeContact(app);
  openContact(app);
  const second = app.elements["copy-contact"].handlers.click();
  requests[0].reject(new Error("denied"));
  await first;
  assert.equal(app.context.document.activeElement, app.elements["close-contact"]);
  assert.equal(app.elements["copy-contact"].disabled, true);
  assert.equal(app.elements["copy-contact"].attributes["aria-busy"], "true");
  assert.equal(app.elements["copy-feedback"].textContent, "");
  requests[1].resolve();
  await second;
  assert.equal(app.elements["copy-feedback"].textContent, "复制成功");
});

test("关闭弹窗立即清除复制忙碌状态及物品标题，延迟回调不能复原", async () => {
  let finish;
  const app = storedApp([record()], { clipboard: { writeText() { return new Promise((resolve) => { finish = resolve; }); } } });
  clickCard(app, "user-a");
  openContact(app);
  const pending = app.elements["copy-contact"].handlers.click();
  closeContact(app);
  assert.equal(app.elements["copy-contact"].attributes["aria-busy"], "false");
  assert.equal(app.elements["copy-contact"].disabled, true);
  assert.equal(app.elements["copy-contact"].textContent, "一键复制");
  assert.equal(app.elements["contact-item"].textContent, "");
  assert.equal(app.elements["select-contact"].hidden, true);
  finish();
  await pending;
  assert.equal(app.elements["copy-feedback"].textContent, "");
});

test("复制使用当前弹窗展示的文本，避免读取过程中记录变化导致错拷", async () => {
  let same = false;
  const app = storedApp([record()], { clipboard: { async writeText(value) { same = value === app.elements["contact-value"].value; } } });
  clickCard(app, "user-a");
  openContact(app);
  app.context.window.ShiguangApp.getItemById("user-a").contact = "changed-test-value";
  await app.elements["copy-contact"].handlers.click();
  assert.ok(same);
  assert.equal(app.elements["copy-feedback"].textContent, "复制成功");
});

test("超长导入文本完整展示且不会改变本地数据，弹窗物品名按纯文本处理", () => {
  const name = '<img src=x onerror="alert(1)">' + "物品".repeat(200);
  const description = "长描述\n".repeat(300);
  const contact = "test-only-".repeat(100);
  const app = storedApp([record({ name, description, contact })]);
  const before = app.sharedStorage.get(itemsKey);
  clickCard(app, "user-a");
  openContact(app);
  app.elements["select-contact"].dispatch("click");
  assert.equal(app.elements["detail-description"].textContent.length, description.length);
  assert.equal(app.elements["contact-item"].textContent, `物品：${name}`);
  assert.equal(app.elements["contact-item"].children.length, 0);
  assert.equal(app.elements["contact-value"].selectionEnd, contact.length);
  assert.equal(app.sharedStorage.get(itemsKey), before);
});
