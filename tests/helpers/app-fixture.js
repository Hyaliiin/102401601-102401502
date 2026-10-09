const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const testNow = new Date(2026, 9, 9, 12, 0, 0).getTime();
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [testNow])); }
  static now() { return testNow; }
}

// 仅模拟业务交互需要的 DOM；不模拟真实布局、权限或原生 dialog 的背景隔离。
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
    this._textContent = "";
    this.disabled = false;
    this.open = false;
    this.scrollTop = 0;
  }
  set innerHTML(_) { throw new Error("用户内容必须通过安全 DOM API 渲染"); }
  set textContent(value) { this._textContent = String(value); }
  get textContent() { return this._textContent + this.children.map((child) => child.textContent).join(""); }
  showModal() { this.open = true; this.modal = true; }
  close() { this.open = false; this.modal = false; this.dispatch("close"); }
  set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(" "); }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...nodes) { nodes.forEach((node) => { node.parentElement = this; }); this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children.forEach((node) => { node.parentElement = null; }); this.children = []; this.append(...nodes); }
  focus() { this.focused = true; if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
  closest(selector) { return this.classes.has(selector.slice(1)) ? this : this.parentElement?.closest(selector) || null; }
  reset() { this.fields.forEach((field) => { field.value = ""; }); }
  dispatch(type, event = {}) {
    const payload = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...event };
    this.handlers[type]?.(payload);
    return payload;
  }
}

function createApp(sharedStorage = new Map(), options = {}) {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  Object.entries(elements).forEach(([id, element]) => { element.id = id; });
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    elements[match[1]].hidden = /\shidden(?:\s|>)/.test(match[0]);
  }
  elements["item-list"].dataset = {};
  elements["item-category"].value = "";
  elements["publish-form"].fields = ["item-name", "item-category", "item-location", "event-time", "item-description", "item-contact"].map((id) => elements[id]);
  const filters = ["lost", "found", "latest"].map((filter) => new Element({ filter }));
  const quickKeywords = ["水杯", "钥匙", "笔记本"].map((keyword) => new Element({ keyword }));
  const modes = ["lost", "found"].map((mode) => new Element({ mode }));
  const myPostFilters = ["all", "active", "completed"].map((myFilter) => new Element({ myFilter }));
  const nav = ["home", "publish", "my-posts"].map((page) => new Element({ page }));
  const document = {
    body: new Element(),
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
      if (selector === ".quick-keyword") return quickKeywords;
      if (selector === ".mode-button") return modes;
      if (selector === ".my-post-filter") return myPostFilters;
      if (selector === ".nav-item") return nav;
      return [];
    },
    createElement() { const element = new Element(); element.ownerDocument = document; return element; }
  };
  Object.values(elements).forEach((element) => { element.ownerDocument = document; });
  [...filters, ...quickKeywords, ...modes, ...myPostFilters, ...nav].forEach((element) => { element.ownerDocument = document; });
  const localStorage = {
    getItem(key) { return sharedStorage.has(key) ? sharedStorage.get(key) : null; },
    setItem(key, value) { sharedStorage.set(key, String(value)); }
  };
  if (!sharedStorage.has("shiguang.owner.v1") && options.ownerId !== null) {
    sharedStorage.set("shiguang.owner.v1", options.ownerId || "local-owner");
  }
  const location = { hash: options.hash || "" };
  const window = {
    handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; },
    dispatchEvent(event) { this.handlers[event.type]?.(event); },
    localStorage: options.localStorage || localStorage, setTimeout() {},
    location, navigator: { clipboard: options.clipboard },
    history: { replaceState(_state, _title, hash) { location.hash = hash; } },
    scrollY: 0, scrollTo(_x, y) { this.scrollY = y; }
  };
  const context = vm.createContext({ document, window, console, Intl, Date: TestDate, Math, Set, Object, Array, JSON, Number, String });
  ["logic.js", "storage.js", "app.js"].forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, "js", file), "utf8"), context, { filename: file }));
  return { context, elements, filters, modes, myPostFilters, nav, quickKeywords, sharedStorage };
}

function fillRequiredForm(elements, type = "lost", name = "蓝色水杯") {
  elements["item-name"].value = name;
  elements["item-category"].value = "水杯";
  elements["item-location"].value = type === "lost" ? "图书馆二楼" : "第一食堂门口";
  elements["event-time"].value = "2026-10-09T10:30";
  elements["item-description"].value = "带有贴纸的随行杯";
  elements["item-contact"].value = "wx_example";
}

module.exports = { createApp, fillRequiredForm, TestDate, root };
