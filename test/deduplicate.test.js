// 重複排除ユーティリティ（src/utils/deduplicate.js）のテスト。

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  normalizeUrl,
  loadProcessed,
  filterNew,
  addProcessed,
  saveProcessed,
} from "../src/utils/deduplicate.js";

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dedup-test-"));
  return path.join(dir, "processed-items.json");
}

test("normalizeUrl: ハッシュ・末尾スラッシュ・トラッキングパラメータを除去する", () => {
  const a = normalizeUrl("https://Example.com/articles/1/#section");
  const b = normalizeUrl("https://example.com/articles/1?utm_source=twitter&utm_medium=sns");
  assert.equal(a, "https://example.com/articles/1");
  assert.equal(b, "https://example.com/articles/1");
});

test("filterNew: 既に処理済みのURLは除外される", () => {
  const items = [
    { url: "https://example.com/a", title: "A" },
    { url: "https://example.com/b", title: "B" },
  ];
  const processed = { items: [{ url: "https://example.com/a", title: "A", processedAt: "2026-08-01T00:00:00.000Z" }] };

  const result = filterNew(items, processed);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://example.com/b");
});

test("同じ入力を2回通すと2回目は0件になる", () => {
  const items = [
    { url: "https://example.com/a", title: "A" },
    { url: "https://example.com/b", title: "B" },
  ];
  let processed = { items: [] };

  const firstRound = filterNew(items, processed);
  assert.equal(firstRound.length, 2);
  processed = addProcessed(firstRound, processed);

  const secondRound = filterNew(items, processed);
  assert.equal(secondRound.length, 0);
});

test("loadProcessed: ファイルが無い場合はwarnして空扱いにする", () => {
  const warnings = [];
  const log = { warn: (msg) => warnings.push(msg) };
  const result = loadProcessed(path.join(os.tmpdir(), "does-not-exist-12345.json"), log);

  assert.deepEqual(result, { items: [] });
  assert.equal(warnings.length, 1);
});

test("loadProcessed: JSONが壊れている場合もwarnして空扱いにする", () => {
  const file = tmpFile();
  fs.writeFileSync(file, "{ 壊れたJSON ,,,");
  const warnings = [];
  const log = { warn: (msg) => warnings.push(msg) };

  const result = loadProcessed(file, log);
  assert.deepEqual(result, { items: [] });
  assert.equal(warnings.length, 1);
});

test("addProcessed: limit件で切り詰められる", () => {
  const items = [{ url: "https://example.com/new", title: "New" }];
  const existing = { items: Array.from({ length: 10 }, (_, i) => ({ url: `https://example.com/${i}`, title: `${i}`, processedAt: "2026-08-01T00:00:00.000Z" })) };

  const result = addProcessed(items, existing, 5);
  assert.equal(result.items.length, 5);
  assert.equal(result.items[0].url, "https://example.com/new");
});

test("saveProcessed → loadProcessed で往復できる", () => {
  const file = tmpFile();
  const processed = { items: [{ url: "https://example.com/x", title: "X", processedAt: "2026-08-01T00:00:00.000Z" }] };

  saveProcessed(file, processed);
  const loaded = loadProcessed(file, { warn: () => {} });
  assert.deepEqual(loaded, processed);
});
