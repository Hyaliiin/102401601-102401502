const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp, fillRequiredForm } = require("./helpers/app-fixture");

const itemsKey = "shiguang.items.v1";
const ownerKey = "shiguang.owner.v1";
function item(overrides = {}) {
  return {
    id: "own-lost", type: "lost", name: "蓝色水杯", category: "水杯", location: "图书馆二楼",
    eventAt: "2026-10-08T10:00:00.000Z", description: "杯身有贴纸", contact: "wx_test",
    status: "searching", publishedAt: "2026-10-09T09:20:00.000Z", ownerId: "local-owner", ...overrides
  };
}
function storedApp(records = [item()], options = {}) {
  return createApp(new Map([[itemsKey, JSON.stringify(records)], [ownerKey, "local-owner"]]), options);
}
function myPosts(app) {
  app.nav.find((entry) => entry.dataset.page === "my-posts").dispatch("click");
}
function openOwnedDetail(app, id = "own-lost") {
  const list = app.elements["my-post-list"];
  const card = list.children.find((entry) => entry.dataset.itemId === id);
  assert.ok(card, `我的发布中存在 ${id}`);
  list.dispatch("click", { target: card });
  return card;
}
function openConfirmation(app, id = "own-lost") {
  myPosts(app);
  if (id) openOwnedDetail(app, id);
  assert.equal(app.elements["complete-item"].hidden, false);
  app.elements["complete-item"].dispatch("click");
  assert.equal(app.elements["status-confirm-dialog"].open, true);
}
function statusLogic(app = createApp()) { return app.context.window.ShiguangLogic; }

test("完成状态根据寻物和招领类型确定，异常记录返回 null", () => {
  const logic = statusLogic();
  assert.equal(logic.getCompletedStatus(item()), "recovered");
  assert.equal(logic.getCompletedStatus(item({ type: "found" })), "returned");
  for (const invalid of [null, {}, [], item({ type: "other" }), item({ type: null })]) {
    assert.equal(logic.getCompletedStatus(invalid), null);
  }
});

test("寻物完成返回已找回记录副本，不修改输入和发布时间", () => {
  const record = item();
  const logic = statusLogic();
  const result = logic.completeItem(record, [record]);
  assert.equal(result.ok, true);
  assert.equal(result.item.status, "recovered");
  assert.equal(result.item.publishedAt, record.publishedAt);
  assert.equal(record.status, "searching");
  assert.notEqual(result.item, record);
  assert.equal(logic.canCompleteItem(record, [record]), true);
});

test("招领完成只返回已归还状态", () => {
  const record = item({ id: "own-found", type: "found", status: "pending" });
  const result = statusLogic().completeItem(record, [record]);
  assert.equal(result.ok, true);
  assert.equal(result.item.status, "returned");
  assert.equal(record.status, "pending");
});

test("完成逻辑拒绝空 ID、错误状态、错误类型和重复完成", () => {
  const logic = statusLogic();
  assert.equal(logic.completeItem(item({ id: " " }), [item()]).reason, "invalid-id");
  assert.equal(logic.completeItem(item({ status: "returned" }), [item({ status: "returned" })]).reason, "already-completed");
  assert.equal(logic.completeItem(item({ type: "other" }), [item({ type: "other" })]).reason, "invalid-type");
  const done = item({ status: "recovered" });
  assert.equal(logic.completeItem(done, [done]).reason, "already-completed");
});

test("完成逻辑拒绝示例、未归属记录及重复 ID 白名单", () => {
  const logic = statusLogic();
  const sample = item({ id: "item-001", ownerId: "demo" });
  assert.equal(logic.completeItem(sample, [sample]).reason, "not-owned");
  assert.equal(logic.completeItem(item(), []).reason, "not-owned");
  assert.equal(logic.completeItem(item(), [item(), item()]).reason, "not-owned");
});

test("完成逻辑拒绝与本人记录类型、状态或发布者不一致的请求", () => {
  const logic = statusLogic();
  const canonical = item();
  assert.equal(logic.completeItem(item({ type: "found", status: "pending" }), [canonical]).reason, "stale");
  assert.equal(logic.completeItem(item({ status: "pending" }), [canonical]).reason, "stale");
  assert.equal(logic.completeItem(item({ ownerId: "other-owner" }), [canonical]).reason, "stale");
});

test("成功提交到全部筛选后只更新目标 ID，其他记录和字段原样保留", () => {
  const records = [item(), item({ id: "other-lost", name: "另一物品", publishedAt: "2026-10-08T09:00:00Z" })];
  const app = storedApp(records);
  openConfirmation(app);
  app.elements["confirm-status-update"].dispatch("click");
  const saved = JSON.parse(app.sharedStorage.get(itemsKey));
  assert.equal(saved[0].status, "recovered");
  assert.equal(saved[0].publishedAt, records[0].publishedAt);
  assert.deepEqual(saved[0], { ...records[0], status: "recovered" });
  assert.deepEqual(saved[1], records[1]);
});

test("Storage API更新只允许方向正确的单向状态转换", () => {
  const app = storedApp([item(), item({ id: "own-found", type: "found", status: "pending" })]);
  const storage = app.context.window.ShiguangStorage;
  assert.equal(storage.updateItemStatus("own-lost", "returned").reason, "invalid-transition");
  assert.equal(storage.updateItemStatus("own-found", "recovered").reason, "invalid-transition");
  assert.equal(storage.updateItemStatus("own-found", "returned").item.status, "returned");
  assert.equal(storage.updateItemStatus("own-found", "pending").reason, "invalid-transition");
});

test("Storage API拒绝示例、其他发布者及无发布者标识的状态更新", () => {
  const sample = item({ id: "sample-record", ownerId: "demo" });
  const other = item({ id: "other-owner", ownerId: "someone-else" });
  const app = storedApp([sample, other]);
  assert.equal(app.context.window.ShiguangStorage.updateItemStatus(sample.id, "recovered").reason, "not-owned");
  assert.equal(app.context.window.ShiguangStorage.updateItemStatus(other.id, "recovered").reason, "not-owned");
  const noOwner = createApp(new Map([[itemsKey, JSON.stringify([item()])]]), { ownerId: null });
  assert.equal(noOwner.context.window.ShiguangStorage.updateItemStatus("own-lost", "recovered").reason, "not-owned");
});

test("Storage API对无效 ID、缺失 ID 和重复更新返回失败", () => {
  const app = storedApp();
  const storage = app.context.window.ShiguangStorage;
  assert.equal(storage.updateItemStatus("", "recovered").reason, "invalid-id");
  assert.equal(storage.updateItemStatus("not-found", "recovered").reason, "not-found");
  assert.equal(storage.updateItemStatus("own-lost", "recovered").ok, true);
  assert.equal(storage.updateItemStatus("own-lost", "recovered").reason, "already-completed");
});

test("Storage API只更新唯一目标，不更改记录顺序或原发布时间", () => {
  const records = [item({ id: "first" }), item({ id: "second", type: "found", status: "pending" })];
  const app = storedApp(records);
  const result = app.context.window.ShiguangStorage.updateItemStatus("second", "returned");
  assert.equal(result.ok, true);
  const reread = app.context.window.ShiguangStorage.loadItems().items;
  assert.deepEqual(reread.map((record) => record.id), ["first", "second"]);
  assert.deepEqual(reread[0], records[0]);
  assert.equal(reread[1].status, "returned");
  assert.equal(reread[1].publishedAt, records[1].publishedAt);
});

test("Storage损坏时拒绝写入并保留原始数据", () => {
  const app = storedApp();
  const raw = "{corrupt-json";
  app.sharedStorage.set(itemsKey, raw);
  const result = app.context.window.ShiguangStorage.updateItemStatus("own-lost", "recovered");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "corrupt");
  assert.equal(app.sharedStorage.get(itemsKey), raw);
});

test("Storage写入失败和不可访问时返回失败，不改变已读记录", () => {
  const app = storedApp();
  const before = app.sharedStorage.get(itemsKey);
  app.context.window.localStorage.setItem = () => { throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
  assert.equal(app.context.window.ShiguangStorage.updateItemStatus("own-lost", "recovered").reason, "quota");
  assert.equal(app.sharedStorage.get(itemsKey), before);
  const blocked = storedApp([item()], { localStorage: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } } });
  assert.equal(blocked.context.window.ShiguangStorage.updateItemStatus("own-lost", "recovered").reason, "unavailable");
});

test("状态存储后重新加载仍为完成状态", () => {
  const app = storedApp();
  assert.equal(app.context.window.ShiguangStorage.updateItemStatus("own-lost", "recovered").ok, true);
  const refreshed = createApp(app.sharedStorage);
  assert.equal(refreshed.context.window.ShiguangLogic.getItemById(
    refreshed.context.window.ShiguangStorage.loadItems().items, "own-lost"
  ).status, "recovered");
});

test("我的发布导航只显示当前本地发布者记录，不混入示例或其他发布者", () => {
  const app = storedApp([item(), item({ id: "other", ownerId: "other-owner" })]);
  myPosts(app);
  assert.equal(app.elements["header-title"].textContent, "我的发布");
  assert.equal(app.elements["header-subtitle"].textContent, "记录每一条线索，也记录每一次找回。");
  assert.equal(app.elements["my-post-count"].textContent, "1");
  assert.deepEqual(app.elements["my-post-list"].children.map((card) => card.dataset.itemId), ["own-lost"]);
  assert.equal(app.elements["item-list"].children.some((card) => card.dataset.itemId === "item-001"), true);
});

test("我的发布倒序展示本人全部记录，空列表引导去发布", () => {
  const app = storedApp([
    item({ id: "older", publishedAt: "2026-10-08T09:00:00Z" }),
    item({ id: "newer", publishedAt: "2026-10-09T10:00:00Z" }),
    item({ id: "foreign", ownerId: "foreign-owner", publishedAt: "2026-10-10T10:00:00Z" })
  ]);
  myPosts(app);
  assert.deepEqual(app.elements["my-post-list"].children.map((card) => card.dataset.itemId), ["newer", "older"]);
  const empty = storedApp([]);
  myPosts(empty);
  assert.equal(empty.elements["my-post-count"].textContent, "0");
  assert.match(empty.elements["my-post-list"].children[0].textContent, /还没有发布记录/);
  empty.elements["my-post-list"].children[0].children.at(-1).dispatch("click");
  assert.equal(empty.elements["publish-view"].hidden, false);
  assert.equal(empty.context.document.activeElement, empty.elements["item-name"]);
});

test("全部、进行中、已完成筛选按业务状态切换并更新结果统计", () => {
  const app = storedApp([
    item({ id: "lost-open", status: "searching" }),
    item({ id: "found-open", type: "found", status: "pending" }),
    item({ id: "lost-done", status: "recovered" }),
    item({ id: "found-done", type: "found", status: "returned" })
  ]);
  myPosts(app);
  assert.equal(app.elements["my-post-count"].textContent, "4");
  assert.match(app.elements["my-post-filter-count"].textContent, /全部 4 条/);
  app.myPostFilters[1].dispatch("click");
  assert.deepEqual(app.elements["my-post-list"].children.map((card) => card.dataset.itemId), ["lost-open", "found-open"]);
  assert.match(app.elements["my-post-filter-count"].textContent, /进行中 2 条/);
  app.myPostFilters[2].dispatch("click");
  assert.deepEqual(app.elements["my-post-list"].children.map((card) => card.dataset.itemId), ["lost-done", "found-done"]);
  assert.match(app.elements["my-post-filter-count"].textContent, /已完成 2 条/);
  assert.equal(app.elements["my-post-count"].textContent, "4");
});

test("无匹配筛选显示提示并允许鼠标返回全部", () => {
  const app = storedApp([item()]);
  myPosts(app);
  app.myPostFilters[2].dispatch("click");
  assert.match(app.elements["my-post-list"].children[0].textContent, /暂无已完成信息/);
  app.elements["my-post-list"].children[0].children.at(-1).dispatch("click");
  assert.deepEqual(app.elements["my-post-list"].children.map((card) => card.dataset.itemId), ["own-lost"]);
});

test("我的发布筛选支持方向键、Home、End并更新选中无障碍状态", () => {
  const app = storedApp([item()]);
  myPosts(app);
  const first = app.myPostFilters[0];
  first.dispatch("keydown", { key: "ArrowRight" });
  assert.equal(app.myPostFilters[1].attributes["aria-selected"], "true");
  assert.equal(app.myPostFilters[1].attributes.tabindex, "0");
  app.myPostFilters[1].dispatch("keydown", { key: "End" });
  assert.equal(app.myPostFilters[2].attributes["aria-selected"], "true");
  app.myPostFilters[2].dispatch("keydown", { key: "ArrowRight" });
  assert.equal(app.myPostFilters[0].attributes["aria-selected"], "true");
});

test("我的发布筛选键盘导航兼容原生 NodeList（不依赖数组 indexOf）", () => {
  const app = createApp(new Map([[itemsKey, JSON.stringify([item()])], [ownerKey, "local-owner"]]), { nativeMyPostNodeList: true });
  myPosts(app);
  app.myPostFilters[0].dispatch("keydown", { key: "ArrowRight" });
  assert.equal(app.myPostFilters[1].attributes["aria-selected"], "true");
  assert.equal(app.context.document.activeElement, app.myPostFilters[1]);
  app.myPostFilters[1].dispatch("keydown", { key: "End" });
  assert.equal(app.myPostFilters[2].attributes["aria-selected"], "true");
  assert.equal(app.context.document.activeElement, app.myPostFilters[2]);
  app.myPostFilters[2].dispatch("keydown", { key: "Home" });
  assert.equal(app.myPostFilters[0].attributes["aria-selected"], "true");
});

test("详情状态更新入口只在我的发布记录详情出现", () => {
  const app = storedApp();
  const homeCard = app.elements["item-list"].children.find((card) => card.dataset.itemId === "own-lost");
  assert.ok(homeCard);
  app.elements["item-list"].dispatch("click", { target: homeCard });
  assert.equal(app.elements["complete-item"].hidden, true);
  app.elements["detail-back"].dispatch("click");
  myPosts(app);
  openOwnedDetail(app);
  assert.equal(app.elements["complete-item"].hidden, false);
  assert.equal(app.elements["complete-item"].textContent, "标记为已找到");
});

test("确认弹窗文案随寻物和招领类型变化，暂不修改保留原始数据", () => {
  for (const [record, title, description] of [
    [item(), "确认物品已找回？", "确认后状态将变为“已找到”，无法撤回。"],
    [item({ id: "found", type: "found", status: "pending" }), "确认物品已归还？", "确认后状态将变为“已归还”，无法撤回。"]
  ]) {
    const app = storedApp([record]);
    myPosts(app);
    openConfirmation(app, record.id);
    assert.equal(app.elements["status-confirm-title"].textContent, title);
    assert.equal(app.elements["status-confirm-description"].textContent, description);
    app.elements["cancel-status-update"].dispatch("click");
    assert.equal(app.elements["status-confirm-dialog"].open, false);
    assert.equal(JSON.parse(app.sharedStorage.get(itemsKey))[0].status, record.status);
  }
});

test("确认完成后模态关闭，详情和筛选列表立刻显示新状态且隐藏完成按钮", () => {
  const app = storedApp();
  myPosts(app);
  app.myPostFilters[1].dispatch("click");
  openConfirmation(app, "own-lost");
  app.elements["confirm-status-update"].dispatch("click");
  assert.equal(app.elements["status-confirm-dialog"].open, false);
  assert.match(app.elements["detail-status-feedback"].textContent, /已找到/);
  assert.equal(app.elements["detail-status"].textContent, "已找到");
  assert.equal(app.elements["complete-item"].hidden, true);
  assert.match(app.elements["my-post-list"].children[0].textContent, /暂无进行中信息/);
  assert.equal(JSON.parse(app.sharedStorage.get(itemsKey))[0].status, "recovered");
});

test("完成后的信息仍在我的发布全部列表，可查看详情和联系方式", () => {
  const app = storedApp([item({ status: "recovered" })]);
  myPosts(app);
  assert.equal(app.elements["my-post-count"].textContent, "1");
  openOwnedDetail(app, "own-lost");
  assert.equal(app.elements["detail-status"].textContent, "已找到");
  assert.equal(app.elements["complete-item"].hidden, true);
  app.elements["view-contact"].dispatch("click");
  assert.equal(app.elements["contact-dialog"].open, true);
  assert.equal(app.elements["contact-value"].value, "wx_test");
});

test("一次状态提交同步刷新首页卡片状态", () => {
  const app = storedApp();
  openConfirmation(app, "own-lost");
  app.elements["confirm-status-update"].dispatch("click");
  app.nav[0].dispatch("click");
  const card = app.elements["item-list"].children.find((entry) => entry.dataset.itemId === "own-lost");
  assert.match(card.textContent, /已找到/);
});

test("一次状态提交同步刷新已存在的搜索结果卡片", () => {
  const app = storedApp();
  app.elements["search-entry"].dispatch("click");
  app.elements["search-keyword"].value = "蓝色水杯";
  app.elements["search-form"].dispatch("submit");
  assert.match(app.elements["search-result-list"].children[0].textContent, /寻找中/);
  myPosts(app);
  openConfirmation(app, "own-lost");
  app.elements["confirm-status-update"].dispatch("click");
  assert.match(app.elements["search-result-list"].children.find((card) => card.dataset.itemId === "own-lost").textContent, /已找到/);
});

test("状态更新不改变原发布时间或搜索结果次序", () => {
  const older = item({ id: "older", name: "蓝色水杯", publishedAt: "2026-10-08T09:00:00Z" });
  const newer = item({ id: "newer", name: "蓝色水杯", publishedAt: "2026-10-09T10:00:00Z" });
  const app = storedApp([older, newer]);
  app.elements["search-entry"].dispatch("click");
  app.elements["search-keyword"].value = "水杯";
  app.elements["search-form"].dispatch("submit");
  myPosts(app);
  openConfirmation(app, "older");
  app.elements["confirm-status-update"].dispatch("click");
  assert.deepEqual(app.elements["search-result-list"].children.map((card) => card.dataset.itemId), ["newer", "item-001", "older"]);
  const saved = JSON.parse(app.sharedStorage.get(itemsKey));
  assert.equal(saved[0].publishedAt, older.publishedAt);
});

test("状态成功后详情地址刷新恢复已完成状态", () => {
  const app = storedApp();
  myPosts(app);
  openConfirmation(app, "own-lost");
  app.elements["confirm-status-update"].dispatch("click");
  const refreshed = createApp(app.sharedStorage, { hash: "#item=own-lost" });
  assert.equal(refreshed.elements["detail-status"].textContent, "已找到");
  assert.equal(refreshed.elements["complete-item"].hidden, true);
});

test("存储损坏或写入失败时弹窗报告错误，不改变状态或谎报成功", () => {
  for (const mode of ["corrupt", "quota"]) {
    const app = storedApp();
    myPosts(app);
    openConfirmation(app, "own-lost");
    const before = app.sharedStorage.get(itemsKey);
    if (mode === "corrupt") app.sharedStorage.set(itemsKey, "{bad");
    else app.context.window.localStorage.setItem = () => { throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
    app.elements["confirm-status-update"].dispatch("click");
    assert.equal(app.elements["status-confirm-dialog"].open, true);
    assert.equal(app.elements["status-confirm-error"].hidden, false);
    assert.doesNotMatch(app.elements["status-confirm-error"].textContent, /成功|已找到|已归还/);
    assert.equal(app.elements["detail-status"].textContent, "寻找中");
    assert.equal(app.elements["detail-status-feedback"].hidden, true);
    if (mode === "corrupt") assert.equal(app.sharedStorage.get(itemsKey), "{bad");
    else assert.equal(app.sharedStorage.get(itemsKey), before);
  }
});

test("重复点击确认只进行一次状态写入", () => {
  const app = storedApp();
  myPosts(app);
  openConfirmation(app, "own-lost");
  let writes = 0;
  const storage = app.context.window.ShiguangStorage;
  app.context.window.ShiguangStorage = { ...storage, updateItemStatus(...args) { writes += 1; return storage.updateItemStatus(...args); } };
  app.elements["confirm-status-update"].dispatch("click");
  app.elements["confirm-status-update"].dispatch("click");
  assert.equal(writes, 1);
  assert.equal(JSON.parse(app.sharedStorage.get(itemsKey))[0].status, "recovered");
});

test("状态更新弹窗支持 Esc、焦点循环与取消后焦点恢复", () => {
  const app = storedApp();
  myPosts(app);
  openConfirmation(app, "own-lost");
  const { elements, context } = app;
  assert.equal(context.document.activeElement, elements["cancel-status-update"]);
  elements["close-status-confirm"].focus();
  elements["status-confirm-dialog"].dispatch("keydown", { key: "Tab", shiftKey: true });
  assert.equal(context.document.activeElement, elements["confirm-status-update"]);
  elements["status-confirm-dialog"].dispatch("keydown", { key: "Tab" });
  assert.equal(context.document.activeElement, elements["close-status-confirm"]);
  elements["status-confirm-dialog"].dispatch("keydown", { key: "Escape" });
  assert.equal(elements["status-confirm-dialog"].open, false);
  assert.equal(context.document.activeElement, elements["complete-item"]);
  assert.equal(JSON.parse(app.sharedStorage.get(itemsKey))[0].status, "searching");
});

test("无效、示例或完成记录的直接详情地址没有状态更新按钮", () => {
  for (const hash of ["#item=item-001", "#item=missing"]) {
    const app = storedApp([], { hash });
    assert.equal(app.elements["complete-item"].hidden, true);
  }
});

test("特殊字符物品名、说明及类别均以文本展示", () => {
  const payload = '<b onclick="alert(1)">水杯 & 伞</b>';
  const app = storedApp([item({ name: payload, description: payload, category: payload })]);
  myPosts(app);
  const card = app.elements["my-post-list"].children[0];
  assert.equal(card.children[1].children[1].textContent, payload);
  openOwnedDetail(app);
  assert.equal(app.elements["detail-name"].textContent, payload);
  assert.equal(app.elements["detail-description"].textContent, payload);
  assert.equal(app.elements["detail-category"].textContent, payload);
});

test("发布成功的新记录归入本人列表，并在刷新后继续显示", () => {
  const app = createApp();
  app.nav[1].dispatch("click");
  fillRequiredForm(app.elements, "lost", "刚发布的物品");
  app.elements["publish-form"].dispatch("submit");
  const id = JSON.parse(app.sharedStorage.get(itemsKey))[0].id;
  myPosts(app);
  assert.deepEqual(app.elements["my-post-list"].children.map((card) => card.dataset.itemId), [id]);
  const refreshed = createApp(app.sharedStorage);
  myPosts(refreshed);
  assert.equal(refreshed.elements["my-post-count"].textContent, "1");
  assert.equal(refreshed.elements["my-post-list"].children[0].dataset.itemId, id);
});

test("首次发布时创建的本地发布者 ID 在当前会话立即用于我的发布", () => {
  const app = createApp(new Map(), { ownerId: null });
  assert.equal(app.context.window.ShiguangStorage.loadOwnerId(), null);
  app.nav[1].dispatch("click");
  fillRequiredForm(app.elements, "lost", "首次发布的水杯");
  app.elements["publish-form"].dispatch("submit");
  const saved = JSON.parse(app.sharedStorage.get(itemsKey))[0];
  assert.ok(saved.ownerId);
  myPosts(app);
  assert.equal(app.elements["my-post-count"].textContent, "1");
  assert.equal(app.elements["my-post-list"].children[0].dataset.itemId, saved.id);
});

test("损坏或占用保留值的发布者 ID 会安全生成新 ID，避免记录漏出现在本人列表", () => {
  for (const invalidOwnerId of ["demo", " \t "]) {
    const app = createApp(new Map(), { ownerId: invalidOwnerId });
    assert.equal(app.context.window.ShiguangStorage.loadOwnerId(), null);
    app.nav[1].dispatch("click");
    fillRequiredForm(app.elements, "found", `修复标识测试 ${invalidOwnerId.length}`);
    app.elements["publish-form"].dispatch("submit");
    const saved = JSON.parse(app.sharedStorage.get(itemsKey))[0];
    assert.notEqual(saved.ownerId, "demo");
    assert.ok(saved.ownerId.trim());
    myPosts(app);
    assert.equal(app.elements["my-post-count"].textContent, "1");
    assert.equal(app.elements["my-post-list"].children[0].dataset.itemId, saved.id);
  }
});
