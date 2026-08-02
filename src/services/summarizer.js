// 記事を生成AI（既定: Gemini）で日本語要約するサービス。
// dryRun=true のときはAPIを呼ばず、確認用のスタブ要約を返す（APIキーが無くても動く）。

import fs from "node:fs";
import { truncate } from "../utils/format.js";

const DEFAULT_MODEL = "gemini-3.6-flash";

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

  const results = [];
  let successCount = 0;

  for (const item of items) {
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
