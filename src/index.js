// このファイルが全体の処理をつなぐ入口（オーケストレーション）。
// GitHub Actions からもローカルからも、この1本だけ実行すれば動く。
//
// 処理の流れ:
//   1. 設定を読み込む（config/sources.json, config/settings.json）
//   2. 環境変数をチェックする（実送信モードのときだけ）
//   3. 情報を収集する（collectors）
//   4. 過去に処理済みか確認する（deduplicate）※実送信モードのみ
//   5. 生成AIで要約する（summarizer）
//   6. メール本文を作る（templates）
//   7. Resendで送信する（--dry-run なら送らない）
//   8. 処理済みデータを保存する（実送信モードのみ）
//
// 終了コード:
//   0 = 成功（送信スキップを含む）
//   2 = 設定不備（環境変数が足りない）
//   3 = 取得失敗（RSSの取得件数が足りない）
//   4 = 要約失敗（生成AIの呼び出しが全滅した）
//   5 = 送信失敗（Resend APIの呼び出しに失敗した）

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectRss } from "./collectors/rss.js";
import { summarizeItems } from "./services/summarizer.js";
import { buildDigestEmail } from "./templates/digest-email.js";
import { sendDigestEmail } from "./services/resend.js";
import { loadProcessed, filterNew, addProcessed, saveProcessed } from "./utils/deduplicate.js";
import { logger } from "./utils/logger.js";

// import.meta.url を基準にパスを解決する。
// これにより「どのディレクトリから node src/index.js を実行しても」
// また「GitHub Actionsの実行環境でも」設定ファイルを正しく見つけられる。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const SOURCES_PATH = path.join(ROOT_DIR, "config", "sources.json");
const SETTINGS_PATH = path.join(ROOT_DIR, "config", "settings.json");
const PROCESSED_PATH = path.join(ROOT_DIR, "data", "processed-items.json");
const PREVIEW_PATH = path.join(ROOT_DIR, "data", "email-preview.html");
const PROMPT_PATH = path.join(ROOT_DIR, "prompts", "article-summary.md");

// 実送信モードで必須の環境変数。値そのものは絶対にログへ出さない。
const REQUIRED_ENV_VARS = ["GEMINI_API_KEY", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_TO"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// 設定ファイルを読み込む。JSONが壊れている場合はどのファイルかを明示してexit 2する。
function readConfigJson(filePath, label) {
  try {
    return readJson(filePath);
  } catch (err) {
    logger.error(
      `${label} が正しいJSON形式ではありません（${err.message}）。カンマや引用符の閉じ忘れがないか確認してください`
    );
    process.exit(2);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // 1. 設定を読み込む
  const sources = readConfigJson(SOURCES_PATH, "config/sources.json");
  const settings = readConfigJson(SETTINGS_PATH, "config/settings.json");
  const sendEmail = settings?.sendEmail !== false;
  const realSendMode = !dryRun && sendEmail;

  logger.info(dryRun ? "ドライランモードで実行します" : "通常モードで実行します");

  // 2. 環境変数チェック（実送信モードのときだけ）
  if (realSendMode) {
    const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      logger.error(`環境変数が不足しています: ${missing.join(", ")}`);
      process.exit(2);
    }
  } else {
    logger.info("ドライラン、またはメール送信オフのためAPIキーのチェックは行いません");
  }

  // 未実装の収集元がオンになっている場合は警告だけ出して続行する
  if (settings?.includeYouTube) {
    logger.warn("YouTubeの収集は未実装です（発展Issue #14）");
  }
  if (settings?.includeNote) {
    logger.warn("noteの収集は未実装です（発展Issue #14）");
  }
  if (settings?.includeNews) {
    logger.warn("ニュースサイトの収集は未実装です（発展Issue #14）");
  }

  // 3. 情報を収集する
  logger.info("1/5 記事を収集します");
  const collected =
    settings?.includeRss === false ? [] : await collectRss(sources, settings, logger);

  if (dryRun) {
    // ゴール条件「RSSから3件以上取得できる」の機械判定
    if (collected.length < 3) {
      logger.error(`RSSの取得件数が足りません（${collected.length}件・3件以上が必要）`);
      process.exit(3);
    }
  } else if (collected.length === 0) {
    logger.error("RSSの取得件数が0件でした");
    process.exit(3);
  }
  logger.info(`収集完了: ${collected.length}件`);

  // 4. 過去に処理済みか確認する（実送信モードのみ。dry-runは毎回同じ結果になるようスキップする）
  let newItems;
  if (dryRun) {
    logger.info("ドライランのため重複排除はスキップします");
    newItems = collected;
  } else {
    logger.info("2/5 処理済みの記事を確認します");
    const processed = loadProcessed(PROCESSED_PATH, logger);
    newItems = filterNew(collected, processed);
    logger.info(`重複排除後の新着件数: ${newItems.length}件`);

    if (newItems.length === 0) {
      logger.info("新着なしのためメール送信をスキップします");
      process.exit(0);
    }
  }

  // 5. 対象をmaxItems件に絞る（メール1通の上限）
  let maxItems = settings?.maxItems ?? 5;
  if (typeof maxItems !== "number" || !Number.isFinite(maxItems) || maxItems <= 0) {
    logger.warn(`config/settings.json のmaxItemsが不正な値です（${settings?.maxItems}）。既定値5で続行します`);
    maxItems = 5;
  }
  // 新しい記事から順に選ぶ（特定のRSSに偏らないように）
  const sortedItems = [...newItems].sort((a, b) => {
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
  const targetItems = sortedItems.slice(0, maxItems);

  // 6. 生成AIで要約する
  logger.info("3/5 記事を要約します");
  let itemsWithSummary;
  try {
    itemsWithSummary = await summarizeItems(targetItems, {
      dryRun,
      env: process.env,
      promptPath: PROMPT_PATH,
      log: logger,
    });
  } catch (err) {
    logger.error(`要約処理に失敗しました: ${err.message}`);
    process.exit(4);
  }
  logger.info(`要約完了: ${itemsWithSummary.length}件`);

  // 要約に失敗した記事は今回のメールから除外する（次回の実行で再試行される）
  const summarizedItems = itemsWithSummary.filter((item) => !item.summaryFailed);
  const failedCount = itemsWithSummary.length - summarizedItems.length;
  if (failedCount > 0) {
    logger.warn(`${failedCount}件の要約に失敗したため今回のメールから除外します（次回の実行で再試行されます）`);
  }

  // 7. メール本文を作る
  logger.info("4/5 メール本文を作成します");
  const email = buildDigestEmail(summarizedItems, new Date());

  // 8. 送信する（dry-runはプレビューを保存するだけ）
  logger.info("5/5 メールを送信します");
  if (dryRun) {
    fs.mkdirSync(path.dirname(PREVIEW_PATH), { recursive: true });
    fs.writeFileSync(PREVIEW_PATH, email.html);
    logger.info("ドライランのため送信はせず、プレビューを保存しました");
    console.log(`取得件数: ${collected.length}`);
    console.log(`要約件数: ${summarizedItems.length}`);
    console.log(`件名: ${email.subject}`);
    console.log(`プレビューの保存先: ${PREVIEW_PATH}`);
    process.exit(0);
  }

  if (!sendEmail) {
    logger.info("settings.sendEmail が false のため、送信・処理済み記録の両方をスキップします（動作確認用モード）");
    process.exit(0);
  }

  try {
    await sendDigestEmail(email, { dryRun: false, env: process.env, log: logger });
  } catch (err) {
    logger.error(`メール送信に失敗しました: ${err.message}`);
    process.exit(5);
  }

  // 送信成功後、処理済みとして記録する
  const processed = loadProcessed(PROCESSED_PATH, logger);
  const updated = addProcessed(summarizedItems, processed, 500);
  saveProcessed(PROCESSED_PATH, updated);
  logger.info("送信完了");
  process.exit(0);
}

main().catch((err) => {
  // ここに来るのは想定外の例外のみ（各工程のエラーは上のtry/catchで個別に処理済み）
  logger.error(`予期しないエラーが発生しました: ${err.message}`);
  process.exit(1);
});
