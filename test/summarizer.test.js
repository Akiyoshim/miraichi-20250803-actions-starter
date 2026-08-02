// 要約サービス（src/services/summarizer.js）のテスト。
// ネットワーク・実際のAPI呼び出しは行わない（dryRunと未対応プロバイダの分岐を確認する）。

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeItems } from "../src/services/summarizer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptPath = path.join(__dirname, "..", "prompts", "article-summary.md");

const sampleItems = [
  {
    title: "生成AIが業務効率化を加速させる最新動向",
    url: "https://example.com/articles/1",
    source: "サンプルITニュース",
    publishedAt: "2026-08-03",
    description: "企業における生成AI活用の最新事例をまとめた記事です。",
    content: "企業における生成AI活用の最新事例をまとめた記事です。",
  },
];

test("dryRun: APIキーが無くても要約が返る", async () => {
  const results = await summarizeItems(sampleItems, { dryRun: true, env: {} });

  assert.equal(results.length, 1);
  assert.ok(results[0].summary.startsWith("【ドライラン】"));
  assert.ok(results[0].summary.includes(sampleItems[0].title));
});

test("AI_PROVIDERがgemini以外だと未対応エラーになる", async () => {
  await assert.rejects(
    () => summarizeItems(sampleItems, { dryRun: false, env: { AI_PROVIDER: "openai" } }),
    /AI_PROVIDER "openai" は未対応です/
  );
});

test("プロンプトファイルに必須プレースホルダと出力項目が含まれる", () => {
  const template = fs.readFileSync(promptPath, "utf-8");

  for (const placeholder of ["{{title}}", "{{url}}", "{{source}}", "{{publishedAt}}", "{{content}}"]) {
    assert.ok(template.includes(placeholder), `${placeholder} が含まれること`);
  }

  for (const heading of [
    "タイトル",
    "3行要約",
    "注目ポイント",
    "業務への影響",
    "おすすめする対象者",
    "情報源",
    "URL",
  ]) {
    assert.ok(template.includes(heading), `出力項目「${heading}」が含まれること`);
  }
});
