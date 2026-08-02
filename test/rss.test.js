// RSS collector（feedToItems）のテスト。ネットワークには出ず、ローカルfixtureだけを使う。

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";
import { feedToItems } from "../src/collectors/rss.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = new Parser();

async function loadFixture(name) {
  const xml = fs.readFileSync(path.join(__dirname, "fixtures", name), "utf-8");
  return parser.parseString(xml);
}

test("RSS 2.0 fixtureから共通形式のアイテムを3件以上取り出せる", async () => {
  const feed = await loadFixture("sample-rss.xml");
  const items = feedToItems(feed, "サンプルITニュース", 10);

  assert.ok(items.length >= 3, "3件以上のアイテムが取れること");
  for (const item of items) {
    assert.ok("title" in item);
    assert.ok("url" in item);
    assert.ok("source" in item);
    assert.ok("publishedAt" in item);
    assert.ok("description" in item);
    assert.ok("content" in item);
    assert.equal(item.source, "サンプルITニュース");
  }
});

test("pubDateが無い記事でも落ちず、publishedAtが空文字になる", async () => {
  const feed = await loadFixture("sample-rss.xml");
  const items = feedToItems(feed, "サンプルITニュース", 10);
  const noDateItem = items.find((i) => i.title === "公開日が無い記事のテスト");

  assert.ok(noDateItem, "対象の記事が見つかること");
  assert.equal(noDateItem.publishedAt, "");
});

test("maxItemsで件数が絞られる", async () => {
  const feed = await loadFixture("sample-rss.xml");
  const items = feedToItems(feed, "サンプルITニュース", 2);

  assert.equal(items.length, 2);
});

test("Atom形式（Publickey想定）も同じ共通形式で取り出せる", async () => {
  const feed = await loadFixture("sample-atom.xml");
  const items = feedToItems(feed, "Publickey", 10);

  assert.ok(items.length >= 3);
  for (const item of items) {
    assert.ok(item.title.length > 0);
    assert.ok(item.url.startsWith("https://"));
    assert.equal(item.source, "Publickey");
  }
});
