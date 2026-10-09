const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createApp } = require("./helpers/app-fixture");

const itemsKey = "shiguang.items.v1";
function item(overrides = {}) {
  return {
    id: "extra-water", type: "lost", name: "便携水杯", category: "水杯", location: "图书馆东侧", eventAt: "2026-10-08T10:00:00.000Z",
    description: "杯身有蓝色贴纸", contact: "private-contact", status: "searching", publishedAt: "2026-10-09T10:00:00.000Z", ownerId: "local-owner", ...overrides
  };
}
function appWith(records = []) {
  return createApp(new Map([[itemsKey, JSON.stringify(records)]]));
}
function displayedIds(app) {
  return app.elements["item-list"].children.map((card) => card.dataset.itemId);
}

test("首页类别选项与发布表单及业务类别保持一致", () => {
  const app = createApp();
  const logicCategories = app.context.window.ShiguangLogic.categories;
  const html = fs.readFileSync(require("node:path").join(__dirname, "../index.html"), "utf8");
  const select = html.match(/<select id="home-category-filter"[\s\S]*?<\/select>/)?.[0];
  assert.ok(select);
  const options = Array.from(select.matchAll(/<option(?:\s+value="([^"]*)")?>([^<]*)<\/option>/g), (match) => match[1] ?? match[2]);
  assert.deepEqual(options, ["", ...logicCategories]);
});

test("类别筛选精确匹配相同类别并保持发布时间倒序", () => {
  const app = appWith([
    item({ id: "old-water", publishedAt: "2026-10-07T09:00:00Z" }),
    item({ id: "new-water", publishedAt: "2026-10-10T09:00:00Z" }),
    item({ id: "keys", category: "钥匙", name: "宿舍钥匙", type: "found", status: "pending" })
  ]);
  app.elements["home-category-filter"].value = "水杯";
  app.elements["home-category-filter"].dispatch("change");
  assert.equal(app.elements["home-category-filter"].classes.has("has-value"), true);
  assert.deepEqual(displayedIds(app), ["new-water", "item-001", "old-water"]);
});

test("电子设备、校园卡等分类使用表单的现有类别值", () => {
  const app = appWith([
    item({ id: "device", type: "found", category: "电子设备", status: "pending" }),
    item({ id: "card", category: "校园卡" })
  ]);
  app.filters[2].dispatch("click");
  app.elements["home-category-filter"].value = "电子设备";
  app.elements["home-category-filter"].dispatch("change");
  assert.deepEqual(displayedIds(app), ["device"]);
  app.elements["home-category-filter"].value = "校园卡";
  app.elements["home-category-filter"].dispatch("change");
  assert.deepEqual(displayedIds(app), ["card"]);
});

test("地点支持部分匹配并忽略首尾空格", () => {
  const app = appWith([
    item({ id: "library", location: "图书馆东侧" }),
    item({ id: "canteen", location: "第一食堂门口" })
  ]);
  app.elements["home-location-filter"].value = "  图书馆  ";
  app.elements["home-location-filter"].dispatch("input");
  assert.deepEqual(displayedIds(app), ["library", "item-001"]);
  assert.equal(app.elements["clear-location-filter"].hidden, false);
  assert.equal(app.elements["home-location-filter"].classes.has("has-value"), true);
});

test("地点英文字母大小写不敏感，空白地点不形成过滤条件", () => {
  const app = appWith([
    item({ id: "lib-east", location: "Library East" }),
    item({ id: "lib-west", location: "LIBRARY West" }),
    item({ id: "hall", location: "Main Hall" })
  ]);
  app.filters[2].dispatch("click");
  app.elements["home-location-filter"].value = "  lIbRaRy ";
  app.elements["home-location-filter"].dispatch("input");
  assert.deepEqual(displayedIds(app), ["lib-east", "lib-west"]);
  app.elements["home-location-filter"].value = "   ";
  app.elements["home-location-filter"].dispatch("input");
  assert.equal(displayedIds(app).length, 6);
});

test("类别、地点与寻物/招领筛选可组合", () => {
  const app = appWith([
    item({ id: "found-key", type: "found", category: "钥匙", location: "教学楼一层", status: "pending" }),
    item({ id: "lost-key", type: "lost", category: "钥匙", location: "教学楼二层" }),
    item({ id: "found-umbrella", type: "found", category: "雨伞", location: "教学楼一层", status: "returned" })
  ]);
  app.filters[1].dispatch("click");
  app.elements["home-category-filter"].value = "钥匙";
  app.elements["home-category-filter"].dispatch("change");
  app.elements["home-location-filter"].value = "教学楼";
  app.elements["home-location-filter"].dispatch("input");
  assert.deepEqual(displayedIds(app), ["found-key"]);
  app.filters[2].dispatch("click");
  assert.deepEqual(displayedIds(app), ["found-key", "lost-key"]);
});

test("无结果显示友好状态并可一键清除类别和地点过滤", () => {
  const app = appWith();
  app.elements["home-category-filter"].value = "钥匙";
  app.elements["home-location-filter"].value = "校外不存在地点";
  app.elements["home-location-filter"].dispatch("input");
  const empty = app.elements["item-list"].children[0];
  assert.match(empty.textContent, /没有符合当前筛选条件的信息/);
  assert.match(empty.textContent, /调整类别或地点关键词/);
  empty.children.at(-1).dispatch("click");
  assert.equal(app.elements["home-category-filter"].value, "");
  assert.equal(app.elements["home-location-filter"].value, "");
  assert.equal(app.elements["clear-location-filter"].hidden, true);
  assert.equal(app.context.document.activeElement, app.elements["home-category-filter"]);
  assert.equal(displayedIds(app).length, 1);
});

test("清除地点筛选保留类别筛选并恢复相应结果", () => {
  const app = appWith([
    item({ id: "key-library", category: "钥匙", location: "图书馆" }),
    item({ id: "key-canteen", category: "钥匙", location: "食堂" })
  ]);
  app.elements["home-category-filter"].value = "钥匙";
  app.elements["home-location-filter"].value = "图书馆";
  app.elements["home-location-filter"].dispatch("input");
  assert.deepEqual(displayedIds(app), ["key-library"]);
  app.elements["clear-location-filter"].dispatch("click");
  assert.equal(app.elements["home-category-filter"].value, "钥匙");
  assert.equal(app.context.document.activeElement, app.elements["home-location-filter"]);
  assert.deepEqual(displayedIds(app), ["key-library", "key-canteen"]);
});

test("地点输入使用键盘可访问的原生控件并响应输入及类别 change", () => {
  const app = appWith([item({ id: "umbrella", category: "雨伞", location: "体育馆" })]);
  const category = app.elements["home-category-filter"];
  const location = app.elements["home-location-filter"];
  category.focus();
  category.value = "雨伞";
  category.dispatch("change");
  assert.deepEqual(displayedIds(app), ["umbrella"]);
  location.focus();
  location.value = "体育";
  location.dispatch("input");
  assert.deepEqual(displayedIds(app), ["umbrella"]);
  assert.equal(app.context.document.activeElement, location);
});

test("首页筛选标签支持左右方向键、Home、End和单一Tab焦点", () => {
  const app = appWith([item()]);
  app.filters[0].focus();
  let event = app.filters[0].dispatch("keydown", { key: "ArrowRight" });
  assert.equal(event.defaultPrevented, true);
  assert.equal(app.context.document.activeElement, app.filters[1]);
  assert.equal(app.filters[1].attributes["tabindex"], "0");
  assert.equal(app.filters[0].attributes["tabindex"], "-1");
  app.filters[1].dispatch("keydown", { key: "End" });
  assert.equal(app.context.document.activeElement, app.filters[2]);
  assert.equal(app.filters[2].attributes["aria-selected"], "true");
  app.filters[2].dispatch("keydown", { key: "Home" });
  assert.equal(app.context.document.activeElement, app.filters[0]);
  app.filters[0].dispatch("keydown", { key: "ArrowLeft" });
  assert.equal(app.context.document.activeElement, app.filters[2]);
  assert.equal(app.filters[2].attributes["tabindex"], "0");
});

test("类别地点筛选组有可访问名称，清除按钮带匹配的定位样式类", () => {
  const html = fs.readFileSync(require("node:path").join(__dirname, "../index.html"), "utf8");
  const css = fs.readFileSync(require("node:path").join(__dirname, "../css/style.css"), "utf8");
  assert.match(html, /<div class="home-refinements" role="group" aria-label="按类别和地点筛选">/);
  assert.match(html, /<button id="clear-location-filter" class="clear-location-filter"/);
  assert.match(css, /\.clear-location-filter \{[^}]*position: absolute/);
});

test("特殊字符按普通子串处理，且不通过 HTML 拼接渲染", () => {
  const app = appWith([item({ id: "literal", location: "楼栋 [A] <北门>" })]);
  app.elements["home-location-filter"].value = "[a] <北";
  app.elements["home-location-filter"].dispatch("input");
  assert.deepEqual(displayedIds(app), ["literal"]);
  const card = app.elements["item-list"].children[0];
  assert.equal(card.children[2].textContent, "📍 楼栋 [A] <北门>");
  assert.equal(card.children[2].children.length, 0);
});

test("已完成物品仍参加类别筛选，且过滤不会改写原始数据", () => {
  const completed = item({ id: "done-umbrella", category: "雨伞", status: "returned", type: "found" });
  const app = appWith([completed]);
  app.filters[2].dispatch("click");
  app.elements["home-category-filter"].value = "雨伞";
  app.elements["home-category-filter"].dispatch("change");
  const card = app.elements["item-list"].children.find((entry) => entry.dataset.itemId === "done-umbrella");
  assert.match(card.textContent, /已归还/);
  assert.equal(JSON.parse(app.sharedStorage.get(itemsKey))[0].status, "returned");
  assert.equal(completed.status, "returned");
});

test("纯筛选函数对空集合、异常记录和无效参数安全返回", () => {
  const logic = createApp().context.window.ShiguangLogic;
  assert.deepEqual(Array.from(logic.filterItems(null, { type: "latest" })), []);
  assert.deepEqual(Array.from(logic.filterItems([null, [], { id: "bad" }], { type: "latest" }), (record) => record.id), ["bad"]);
  assert.deepEqual(Array.from(logic.filterItems([item()], { type: "unknown" })), []);
  assert.deepEqual(Array.from(logic.filterItems([item()], null)), []);
});

test("纯筛选函数使用副本排序，不修改原始数组与记录", () => {
  const first = item({ id: "first", publishedAt: "2026-10-08T09:00:00Z" });
  const second = item({ id: "second", publishedAt: "2026-10-10T09:00:00Z" });
  const records = Object.freeze([first, second]);
  const result = createApp().context.window.ShiguangLogic.filterItems(records, { type: "latest", category: "水杯" });
  assert.deepEqual(Array.from(result, (record) => record.id), ["second", "first"]);
  assert.notEqual(result, records);
  assert.equal(records[0], first);
  assert.equal(records[0].publishedAt, "2026-10-08T09:00:00Z");
});
