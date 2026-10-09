const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

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

function createApp(sharedStorage = new Map()) {
  const ids = [
    "home-view", "publish-view", "success-view", "header-title", "header-subtitle", "search-entry", "item-list", "result-count", "interaction-feedback",
    "publish-form", "submit-publish", "form-error", "form-info", "location-label", "event-time-label", "item-location", "event-time", "item-name", "item-category", "item-description", "item-contact", "publish-title",
    "success-item-name", "success-status", "success-action-feedback", "view-details", "continue-publishing", "return-home", "items-title"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
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
  const window = { localStorage, setTimeout() {} };
  const context = vm.createContext({ document, window, console, Intl, Date, Math, Set, Object, Array, JSON, Number, String });
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
