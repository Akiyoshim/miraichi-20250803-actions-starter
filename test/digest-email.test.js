// メールテンプレート（src/templates/digest-email.js）のテスト。

import test from "node:test";
import assert from "node:assert/strict";
import { buildDigestEmail } from "../src/templates/digest-email.js";

const sampleItems = [
  {
    title: "クラウド & <セキュリティ> の最新動向",
    url: "https://example.com/articles/2",
    source: "サンプルITニュース",
    publishedAt: "2026-08-03",
    description: "特集記事の概要",
    content: "特集記事の概要",
    summary: "1行目\n2行目\n3行目",
  },
];

test("件名に日付が入る", () => {
  const { subject } = buildDigestEmail(sampleItems, new Date(2026, 7, 3));
  assert.equal(subject, "【AI情報収集】2026年8月3日のデイリーダイジェスト");
});

test("HTMLにタイトルが入る", () => {
  const { html } = buildDigestEmail(sampleItems, new Date(2026, 7, 3));
  assert.ok(html.includes("サンプルITニュース"));
  assert.ok(html.includes("https://example.com/articles/2"));
});

test("特殊文字がエスケープされる", () => {
  const { html } = buildDigestEmail(sampleItems, new Date(2026, 7, 3));
  assert.ok(!html.includes("<セキュリティ>"));
  assert.ok(html.includes("&lt;セキュリティ&gt;"));
  assert.ok(html.includes("&amp;"));
});

test("テキスト代替が空でなく、改行を含む本文が入っている", () => {
  const { text } = buildDigestEmail(sampleItems, new Date(2026, 7, 3));
  assert.ok(text.length > 0);
  assert.ok(text.includes("クラウド & <セキュリティ> の最新動向"));
  assert.ok(text.includes("1行目"));
});
