const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "logic.js"), "utf8");
const window = {};
vm.runInNewContext(source, vm.createContext({ window, Date, Number, String, Object, Array }));
const { searchItems } = window.ShiguangLogic;

function item(overrides = {}) {
  return {
    id: "demo-1", type: "lost", name: "蓝色水杯", category: "水杯", location: "图书馆二楼",
    description: "杯身贴有校园贴纸", contact: "private-contact", ownerId: "private-owner",
    publishedAt: "2026-10-09T09:20:00+08:00", ...overrides
  };
}

test("按物品名称、类别、地点和描述匹配", () => {
  const records = [item(), item({ id: "demo-2", name: "钥匙串", category: "钥匙", location: "第一食堂", description: "带蓝色挂饰" })];
  assert.equal(searchItems(records, "蓝色水杯")[0].id, "demo-1");
  assert.equal(searchItems(records, "钥匙")[0].id, "demo-2");
  assert.equal(searchItems(records, "图书馆")[0].id, "demo-1");
  assert.equal(searchItems(records, "校园贴纸")[0].id, "demo-1");
});

test("无匹配和空关键词返回空数组", () => {
  const records = [item()];
  assert.equal(searchItems(records, "完全不存在").length, 0);
  assert.equal(searchItems(records, "").length, 0);
  assert.equal(searchItems(records, " \t　 ").length, 0);
});

test("关键词首尾空格被忽略", () => {
  assert.equal(searchItems([item()], "  水杯  ").length, 1);
});

test("英文字母大小写不影响匹配", () => {
  const records = [item({ name: "Blue Bottle", description: "Found near Library" })];
  assert.equal(searchItems(records, "bLuE").length, 1);
  assert.equal(searchItems(records, "LIBRARY").length, 1);
});

test("多条结果按发布时间倒序且不改变输入数组", () => {
  const records = [item({ id: "old", name: "杯子旧记录", publishedAt: "2026-10-01T10:00:00Z" }), item({ id: "new", name: "杯子新记录", publishedAt: "2026-10-09T10:00:00Z" })];
  const before = JSON.stringify(records);
  const results = searchItems(records, "杯子");
  assert.deepEqual(results.map((record) => record.id), ["new", "old"]);
  assert.equal(JSON.stringify(records), before);
  assert.notEqual(results, records);
});

test("特殊字符作为普通文本处理，缺失字段和空记录安全", () => {
  const records = [null, {}, item({ id: "html", name: "<img src=x>" }), item({ id: "regex", description: "A+B [C]" })];
  assert.equal(searchItems(records, "<img src=x>")[0].id, "html");
  assert.equal(searchItems(records, "A+B [C]")[0].id, "regex");
});

test("搜索不匹配联系方式、发布者标识等内部字段", () => {
  const records = [item()];
  assert.equal(searchItems(records, "private-contact").length, 0);
  assert.equal(searchItems(records, "private-owner").length, 0);
});

test("用户发布记录可由同一搜索函数检索", () => {
  const demo = item();
  const userPost = item({ id: "user-9", name: "用户新发布的笔记本", category: "书籍文具", description: "有红色封面", ownerId: "user-local" });
  assert.equal(searchItems([demo, userPost], "用户新发布")[0].id, "user-9");
});

test("无效输入集合和非字符串关键词安全返回空结果", () => {
  assert.equal(searchItems(null, "水杯").length, 0);
  assert.equal(searchItems([item()], null).length, 0);
  assert.equal(searchItems([item()], { toString: () => "水杯" }).length, 0);
});
