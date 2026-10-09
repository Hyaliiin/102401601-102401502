const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const testNow = new Date(2026, 9, 9, 12, 0, 0).getTime();
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [testNow])); }
  static now() { return testNow; }
}

class Element {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.handlers = {};
    this.attributes = {};
    this.children = [];
    this.classes = new Set();
    this.classList = {
      toggle: (name, force) => {
        const enabled = force === undefined ? !this.classes.has(name) : force;
        if (enabled) this.classes.add(name);
        else this.classes.delete(name);
        return enabled;
      },
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name)
    };
    this.firstChild = { textContent: "" };
    this.hidden = false;
    this.value = "";
    this.textContent = "";
    this.disabled = false;
  }
  set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(" "); }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  focus() { this.focused = true; }
  reset() { this.fields.forEach((field) => { field.value = ""; }); }
  dispatch(type, event = {}) {
    const payload = { target: this, preventDefault() {}, ...event };
    this.handlers[type]?.(payload);
    return payload;
  }
}

function createApp(sharedStorage = new Map(), options = {}) {
  const ids = [
    "home-view", "publish-view", "success-view", "header-title", "header-subtitle", "search-entry", "item-list", "result-count", "interaction-feedback",
    "publish-form", "submit-publish", "form-error", "form-info", "location-label", "event-time-label", "item-location", "event-time", "item-name", "item-category", "item-description", "item-contact", "publish-title",
    "success-item-name", "success-status", "success-title", "success-action-feedback", "view-details", "continue-publishing", "return-home", "items-title",
    "item-name-error", "item-category-error", "item-location-error", "event-time-error", "item-description-error", "item-contact-error"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  Object.entries(elements).forEach(([id, element]) => { element.id = id; });
  elements["item-list"].dataset = {};
  elements["item-category"].value = "";
  elements["publish-form"].fields = ["item-name", "item-category", "item-location", "event-time", "item-description", "item-contact"].map((id) => elements[id]);
  const filters = ["lost", "found", "latest"].map((filter) => new Element({ filter }));
  const modes = ["lost", "found"].map((mode) => new Element({ mode }));
  const nav = ["home", "publish", "my-posts"].map((page) => new Element({ page }));
  const document = {
    querySelector(selector) {
      if (selector.startsWith("#")) return elements[selector.slice(1)];
      const latest = selector.match(/^\[data-filter="(.+)"\]$/);
      if (latest) return filters.find((item) => item.dataset.filter === latest[1]);
      const page = selector.match(/^\[data-page="(.+)"\]$/);
      if (page) return nav.find((item) => item.dataset.page === page[1]);
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".filter-tab") return filters;
      if (selector === ".mode-button") return modes;
      if (selector === ".nav-item") return nav;
      return [];
    },
    createElement() { return new Element(); }
  };
  const localStorage = {
    getItem(key) { return sharedStorage.has(key) ? sharedStorage.get(key) : null; },
    setItem(key, value) { sharedStorage.set(key, String(value)); }
  };
  const window = { localStorage: options.localStorage || localStorage, setTimeout() {} };
  const context = vm.createContext({ document, window, console, Intl, Date: TestDate, Math, Set, Object, Array, JSON, Number, String });
  ["logic.js", "storage.js", "app.js"].forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, "js", file), "utf8"), context, { filename: file }));
  return { context, elements, filters, modes, nav, sharedStorage };
}

function fillRequiredForm(elements, type = "lost", name = "蓝色水杯") {
  elements["item-name"].value = name;
  elements["item-category"].value = "水杯";
  elements["item-location"].value = type === "lost" ? "图书馆二楼" : "第一食堂门口";
  elements["event-time"].value = "2026-10-09T10:30";
  elements["item-description"].value = "带有贴纸的随行杯";
  elements["item-contact"].value = "wx_example";
}

test("发布校验、两种模式、初始状态、重复提交和刷新持久化", () => {
  const app = createApp();
  const { context, elements, filters, modes, sharedStorage } = app;
  const submit = () => elements["publish-form"].dispatch("submit");

  assert.equal(elements["item-list"].children.length, 1, "首页寻物示例正常显示");
  navClick(app, "publish");
  submit();
  assert.match(elements["form-error"].textContent, /请填写物品名称/);
  fillRequiredForm(elements);
  elements["item-name"].value = "   ";
  submit();
  assert.match(elements["form-error"].textContent, /请填写物品名称/);
  assert.equal(JSON.parse(sharedStorage.get(context.window.ShiguangStorage.itemsKey) || "[]").length, 0);

  fillRequiredForm(elements);
  submit();
  assert.equal(elements["success-item-name"].textContent, "蓝色水杯");
  assert.equal(elements["success-status"].textContent, "寻找中");
  submit();
  let saved = JSON.parse(sharedStorage.get(context.window.ShiguangStorage.itemsKey));
  assert.equal(saved.length, 1, "成功后重复提交不会重复保存");
  assert.deepEqual(Object.keys(saved[0]), ["id", "type", "name", "category", "location", "eventAt", "description", "contact", "status", "publishedAt", "ownerId"]);

  elements["return-home"].dispatch("click");
  assert.equal(elements["home-view"].hidden, false);
  assert.equal(filters[2].attributes["aria-selected"], "true");
  assert.equal(elements["item-list"].children.length, 4, "新记录出现在首页最新列表");

  const refreshed = createApp(sharedStorage);
  assert.equal(refreshed.elements["item-list"].children.length, 2, "刷新后默认寻物栏目包含演示和用户记录");
  navClick(refreshed, "publish");
  refreshed.modes[1].dispatch("click");
  assert.equal(refreshed.elements["location-label"].firstChild.textContent.trim(), "拾取地点");
  assert.equal(refreshed.elements["event-time-label"].firstChild.textContent.trim(), "拾取时间");
  fillRequiredForm(refreshed.elements, "found", "校园卡");
  refreshed.elements["item-category"].value = "校园卡";
  refreshed.elements["publish-form"].dispatch("submit");
  assert.equal(refreshed.elements["success-status"].textContent, "待认领");
  saved = JSON.parse(sharedStorage.get(context.window.ShiguangStorage.itemsKey));
  assert.equal(saved.length, 2, "寻物和招领内容都持久化");
  assert.equal(saved[1].status, "pending");

  const latestApp = createApp(sharedStorage);
  latestApp.filters[2].dispatch("click");
  assert.equal(latestApp.elements["item-list"].children.length, 5, "重新载入后新增记录仍显示在最新列表");
});

test("验证模块拒绝超长字段和无效类别", () => {
  const { context } = createApp();
  const values = { type: "lost", name: "x".repeat(51), category: "非法类别", location: "地点", eventAt: "2026-10-09T10:30", description: "描述", contact: "联系" };
  const result = context.window.ShiguangLogic.validate(values);
  assert.equal(result.valid, false);
  assert.match(result.errors.name, /不能超过/);
  assert.match(result.errors.category, /有效的物品类别/);
});

test("本地存储不可用时安全返回错误状态", () => {
  const window = { get localStorage() { throw new Error("blocked"); } };
  const context = vm.createContext({ window, Date, Math, JSON, Array, Object, String });
  vm.runInContext(fs.readFileSync(path.join(root, "js", "storage.js"), "utf8"), context);
  assert.equal(context.window.ShiguangStorage.loadItems().ok, false);
  assert.equal(context.window.ShiguangStorage.saveItem({ id: "x" }).ok, false);
});

function navClick(app, page) {
  app.nav.find((item) => item.dataset.page === page).dispatch("click");
}

function validValues(overrides = {}) {
  return { type: "lost", name: "蓝色水杯", category: "水杯", location: "图书馆", eventAt: "2026-10-09T10:30", description: "有贴纸", contact: "wx_example", ...overrides };
}

test("所有必填字段拒绝空白；长度边界与 trim 一致", () => {
  const { context } = createApp();
  const logic = context.window.ShiguangLogic;
  for (const key of ["name", "category", "location", "eventAt", "description", "contact"]) {
    for (const value of ["", " \t\n　", null]) {
      assert.ok(logic.validate(validValues({ [key]: value })).errors[key], `${key} rejects blank input`);
    }
  }
  for (const [key, limit] of Object.entries(logic.limits)) {
    assert.equal(logic.validate(validValues({ [key]: "中".repeat(limit) })).valid, true);
    assert.match(logic.validate(validValues({ [key]: "中".repeat(limit + 1) })).errors[key], /不能超过/);
  }
  assert.ok(logic.validate(validValues({ type: "invalid" })).errors.type);
  const item = logic.createItem(validValues({ name: "  杯子  ", contact: "  wx_test  " }), "owner", "item", new TestDate().toISOString());
  assert.equal(item.name, "杯子");
  assert.equal(item.contact, "wx_test");
});

test("日期验证拒绝未来时间、非法日历与格式，并接受当前时间和闰日", () => {
  const { context } = createApp();
  const validate = context.window.ShiguangLogic.validate;
  for (const type of ["lost", "found"]) {
    assert.match(validate(validValues({ type, eventAt: "2026-10-09T12:01" })).errors.eventAt, /不能晚于当前时间/);
    assert.equal(validate(validValues({ type, eventAt: "2026-10-09T12:00" })).valid, true);
  }
  for (const eventAt of ["not-a-date", "2026-02-30T10:00", "2025-02-29T10:00", "2026-13-01T10:00", "2026-10-01T24:00", "0000-01-01T00:00", "2026-10-01", "2026-10-01T10:00:99"]) {
    assert.match(validate(validValues({ eventAt })).errors.eventAt, /有效/);
  }
  for (const eventAt of ["2024-02-29T10:00", "2026-10-09T11:59:59.999"]) {
    assert.equal(validate(validValues({ eventAt })).valid, true);
  }
});

test("字段错误关联、模式提示、实时纠错与成功页焦点", () => {
  const app = createApp();
  const { elements } = app;
  navClick(app, "publish");
  assert.equal(elements["publish-title"].focused, true);
  assert.equal(elements["event-time"].max, "2026-10-09T12:00");
  elements["publish-form"].dispatch("submit");
  assert.equal(elements["item-name"].focused, true);
  for (const input of elements["publish-form"].fields) {
    assert.equal(input.attributes["aria-invalid"], "true");
    assert.equal(elements[`${input.id}-error`].hidden, false);
  }
  fillRequiredForm(elements);
  elements["event-time"].value = "2026-10-09T12:01";
  elements["publish-form"].dispatch("input");
  assert.equal(elements["item-name"].attributes["aria-invalid"], undefined);
  assert.match(elements["event-time-error"].textContent, /丢失时间不能晚于/);
  app.modes[1].dispatch("click");
  assert.equal(app.modes[1].attributes["aria-pressed"], "true");
  assert.match(elements["event-time-error"].textContent, /拾取时间不能晚于/);
  elements["event-time"].value = "2026-10-09T11:00";
  elements["publish-form"].dispatch("change");
  assert.equal(elements["form-error"].hidden, true);
  elements["publish-form"].dispatch("submit");
  assert.equal(elements["success-title"].focused, true);
  assert.equal(elements["success-status"].textContent, "待认领");
});

test("连续及重入提交只保存一次；经首页再次发布会解锁新表单", () => {
  const app = createApp();
  const { elements, context, sharedStorage } = app;
  const storage = context.window.ShiguangStorage;
  context.window.ShiguangStorage = { ...storage, saveItem(item) {
    assert.equal(elements["submit-publish"].disabled, true);
    assert.equal(elements["publish-form"].attributes["aria-busy"], "true");
    elements["publish-form"].dispatch("submit");
    return storage.saveItem(item);
  } };
  navClick(app, "publish");
  fillRequiredForm(elements);
  for (let i = 0; i < 10; i += 1) elements["publish-form"].dispatch("submit");
  assert.equal(JSON.parse(sharedStorage.get(storage.itemsKey)).length, 1);
  assert.equal(elements["publish-form"].attributes["aria-busy"], "false");
  navClick(app, "home");
  assert.equal(elements["item-list"].children.length, 2, "底部首页导航也刷新新记录");
  navClick(app, "publish");
  assert.equal(elements["submit-publish"].disabled, false);
  assert.equal(elements["item-name"].value, "");
  fillRequiredForm(elements, "lost", "第二条信息");
  elements["publish-form"].dispatch("submit");
  assert.equal(JSON.parse(sharedStorage.get(storage.itemsKey)).length, 2);
  elements["continue-publishing"].dispatch("click");
  assert.equal(elements["item-name"].focused, true);
  assert.equal(elements["submit-publish"].disabled, false);
});

test("存储写入失败保留所有字段，解除忙碌状态并允许重试", () => {
  const shared = new Map();
  let failWrites = true;
  const storage = {
    getItem(key) { return shared.get(key) ?? null; },
    setItem(key, value) {
      if (failWrites && key === "shiguang.items.v1") throw Object.assign(new Error("full"), { name: "QuotaExceededError" });
      shared.set(key, String(value));
    }
  };
  const { context, elements } = createApp(shared, { localStorage: storage });
  fillRequiredForm(elements);
  const values = elements["publish-form"].fields.map((field) => field.value);
  elements["publish-form"].dispatch("submit");
  assert.match(elements["form-error"].textContent, /空间不足/);
  assert.equal(elements["form-error"].focused, true);
  assert.equal(elements["submit-publish"].disabled, false);
  assert.equal(elements["publish-form"].attributes["aria-busy"], "false");
  assert.deepEqual(elements["publish-form"].fields.map((field) => field.value), values);
  assert.equal(shared.has(context.window.ShiguangStorage.itemsKey), false);
  failWrites = false;
  elements["publish-form"].dispatch("submit");
  assert.equal(JSON.parse(shared.get(context.window.ShiguangStorage.itemsKey)).length, 1);
});

test("本地存储被禁用时首页仍可用，发布失败不清空草稿", () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const app = createApp(new Map(), { localStorage: blocked });
  assert.equal(app.elements["item-list"].children.length, 1);
  navClick(app, "publish");
  fillRequiredForm(app.elements);
  app.elements["publish-form"].dispatch("submit");
  assert.match(app.elements["form-error"].textContent, /无法访问本地存储/);
  assert.equal(app.elements["item-name"].value, "蓝色水杯");
  assert.equal(app.elements["submit-publish"].disabled, false);
});

test("首次生成发布者标识时空间不足也显示容量提示", () => {
  const storage = {
    getItem() { return null; },
    setItem() { throw Object.assign(new Error("full"), { name: "QuotaExceededError" }); }
  };
  const { elements } = createApp(new Map(), { localStorage: storage });
  fillRequiredForm(elements);
  elements["publish-form"].dispatch("submit");
  assert.match(elements["form-error"].textContent, /空间不足/);
  assert.equal(elements["item-name"].value, "蓝色水杯");
  assert.equal(elements["submit-publish"].disabled, false);
});

test("损坏 JSON 或非数组不会崩溃，提交也不覆盖原始数据", () => {
  for (const raw of ["{broken", "null", "{}", '"text"', '[{"id":"partial"}]']) {
    const shared = new Map([["shiguang.items.v1", raw]]);
    const { context, elements } = createApp(shared);
    const result = context.window.ShiguangStorage.loadItems();
    assert.equal(result.reason, "corrupt");
    assert.equal(elements["item-list"].children.length, 1);
    fillRequiredForm(elements);
    elements["publish-form"].dispatch("submit");
    assert.match(elements["form-error"].textContent, /记录已损坏/);
    assert.equal(shared.get("shiguang.items.v1"), raw);
    assert.equal(elements["item-name"].value, "蓝色水杯");
  }
});

test("混合损坏及重复 ID 的存储只展示完整记录，保留损坏原文", () => {
  const logic = createApp().context.window.ShiguangLogic;
  const item = logic.createItem(validValues(), "owner", "valid-id", new TestDate().toISOString());
  const raw = JSON.stringify([item, null, { ...item, id: "bad-date", publishedAt: {} }, { ...item, id: "bad-type", type: "invalid" }, item]);
  const shared = new Map([["shiguang.items.v1", raw]]);
  const app = createApp(shared);
  const loaded = app.context.window.ShiguangStorage.loadItems();
  assert.equal(loaded.ok, false);
  assert.equal(loaded.items.length, 1);
  assert.equal(app.elements["item-list"].children.length, 2);
  app.filters[2].dispatch("click");
  assert.equal(app.elements["item-list"].children.length, 4);
  assert.equal(shared.get("shiguang.items.v1"), raw);
});

test("编号连续冲突会有限次退出并允许重试，不会卡死页面", () => {
  const { context, elements } = createApp();
  const storage = context.window.ShiguangStorage;
  let attempts = 0;
  context.window.ShiguangStorage = { ...storage, createId() { attempts += 1; return "item-001"; } };
  fillRequiredForm(elements);
  elements["publish-form"].dispatch("submit");
  assert.equal(attempts, 6);
  assert.match(elements["form-error"].textContent, /编号冲突/);
  assert.equal(elements["submit-publish"].disabled, false);
  context.window.ShiguangStorage = storage;
  elements["publish-form"].dispatch("submit");
  assert.equal(elements["success-view"].hidden, false);
});

test("特殊字符按文本展示，首页寻物/招领与最新排序不受影响", () => {
  const app = createApp();
  const name = '<img src=x onerror="alert(1)">';
  fillRequiredForm(app.elements, "lost", name);
  app.elements["publish-form"].dispatch("submit");
  assert.equal(app.elements["success-item-name"].textContent, name);
  app.elements["return-home"].dispatch("click");
  const cards = app.elements["item-list"].children;
  const title = cards.find((card) => card.children[1].children[1].textContent === name).children[1].children[1];
  assert.equal(title.children.length, 0, "输入未变为 HTML 子节点");
  const saved = JSON.parse(app.sharedStorage.get("shiguang.items.v1"));
  const dates = new Map([
    ["item-001", Date.parse("2026-10-09T09:20:00+08:00")],
    ["item-002", Date.parse("2026-10-08T18:10:00+08:00")],
    ["item-003", Date.parse("2026-10-07T12:30:00+08:00")],
    [saved[0].id, Date.parse(saved[0].publishedAt)]
  ]);
  const timestamps = cards.map((card) => dates.get(card.dataset.itemId));
  assert.deepEqual(timestamps, [...timestamps].sort((a, b) => b - a));
  app.filters[0].dispatch("click");
  assert.equal(app.elements["item-list"].children.length, 2);
  app.filters[1].dispatch("click");
  assert.equal(app.elements["item-list"].children.length, 2);
  assert.ok(app.elements["item-list"].children.every((card) => card.children[0].children[0].textContent === "招领"));
});
