// 記事を生成AI（既定: Gemini）で日本語要約するサービス。
// dryRun=true のときはAPIを呼ばず、確認用のスタブ要約を返す（APIキーが無くても動く）。

import fs from "node:fs";
import { truncate } from "../utils/format.js";

const DEFAULT_MODEL = "gemini-3.6-flash";

// 要約と要約の間に空ける待ち時間（ミリ秒）。
// Gemini APIの無料枠には「1分あたりのリクエスト数（RPM）」の上限があり、
// 待たずに連続実行すると上限を超えた分が HTTP 429 で失敗する。
// 13秒空けると 60 ÷ 13 ≒ 4.6回/分 となり、無料枠の目安（5回/分）に収まる。
// 有料枠を使う場合や上限が変わった場合は、環境変数 AI_INTERVAL_MS で調整できる。
const DEFAULT_INTERVAL_MS = 13000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// プロンプトのプレースホルダ（{{title}} など）を記事情報で置換する
function fillTemplate(template, item) {
  return template
    .replaceAll("{{title}}", item.title || "")
    .replaceAll("{{url}}", item.url || "")
    .replaceAll("{{source}}", item.source || "")
    .replaceAll("{{publishedAt}}", item.publishedAt || "")
    .replaceAll("{{content}}", item.content || "");
}

// APIを呼ばずに返す確認用のスタブ要約
function buildStubSummary(item) {
  const preview = truncate(item.description || item.content || "", 50);
  return `【ドライラン】${item.title}\n${preview}`;
}

// items（共通アイテム形式の配列）を要約し、summaryを付けた配列を返す。
// options: { dryRun, env, promptPath, log }
export async function summarizeItems(items, options = {}) {
  const { dryRun, env = {}, promptPath = "prompts/article-summary.md", log } = options;

  if (dryRun) {
    return items.map((item) => ({ ...item, summary: buildStubSummary(item) }));
  }

  const provider = env.AI_PROVIDER || "gemini";
  if (provider !== "gemini") {
    throw new Error(`AI_PROVIDER "${provider}" は未対応です。MVPは gemini のみ対応しています`);
  }

  // Geminiを呼ぶときだけ動的にimportする（テストのdry-run経路ではSDKに触れない）
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const template = fs.readFileSync(promptPath, "utf-8");

  // 待ち時間を決める。数値として解釈できない値が入っていたら既定値を使う。
  const parsedInterval = Number(env.AI_INTERVAL_MS);
  const intervalMs =
    Number.isFinite(parsedInterval) && parsedInterval >= 0 ? parsedInterval : DEFAULT_INTERVAL_MS;

  const results = [];
  let successCount = 0;

  for (const [index, item] of items.entries()) {
    // 2件目以降は、前の要約からintervalMsだけ待ってから呼ぶ（1件目は待たない）
    if (index > 0 && intervalMs > 0) {
      log?.info(`APIの利用上限を避けるため${intervalMs / 1000}秒待ちます（${index + 1}/${items.length}件目）`);
      await sleep(intervalMs);
    }

    try {
      const prompt = fillTemplate(template, item);
      const response = await ai.models.generateContent({ model, contents: prompt });
      const summary = (response.text ?? "").trim();
      results.push({ ...item, summary });
      successCount++;
    } catch (err) {
      log?.error(`要約に失敗しました: ${item.title}（原因: ${err.message}）`);
      // 失敗した記事はsummaryをnullにし、summaryFailedフラグを立てる。
      // メールには載せず、processed-items.jsonにも記録しない（次回実行で再試行させるため）。
      results.push({ ...item, summary: null, summaryFailed: true });
    }
  }

  if (items.length > 0 && successCount === 0) {
    throw new Error("すべての記事の要約に失敗しました");
  }

  return results;
}
