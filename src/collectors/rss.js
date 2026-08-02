// RSS/Atomフィードから新着記事を取得し、共通アイテム形式に変換するcollector。
// 記事の全文は取得せず、RSSが返す範囲（contentSnippetなど）だけを使う。

import Parser from "rss-parser";
import { formatDateIso, truncate } from "../utils/format.js";

const CONTENT_MAX_LENGTH = 1000;

// rss-parserがパースしたfeedオブジェクトを、共通アイテム形式の配列に変換する。
// maxItems で最新N件に絞る（並び順はフィードの記載順をそのまま使う）。
export function feedToItems(feed, sourceName, maxItems) {
  const items = feed?.items ?? [];
  return items.slice(0, maxItems).map((item) => {
    const publishedAt = formatDateIso(item.isoDate || item.pubDate);
    const rawContent =
      item.contentSnippet || item.content || item.summary || item.description || "";
    return {
      title: item.title || "",
      url: item.link || "",
      source: sourceName,
      publishedAt,
      description: item.contentSnippet || item.summary || item.description || "",
      content: truncate(rawContent, CONTENT_MAX_LENGTH),
    };
  });
}

// config/sources.json の rss 配列を順に取得し、共通アイテム形式の配列にまとめて返す。
// 1つのフィードが失敗しても他のフィードの取得は続ける（全滅しても例外は投げない）。
export async function collectRss(sources, settings, log) {
  const parser = new Parser();
  const maxItems = settings?.maxItems ?? 5;
  const rssSources = sources?.rss ?? [];
  const results = [];

  for (const src of rssSources) {
    try {
      const feed = await parser.parseURL(src.url);
      const items = feedToItems(feed, src.name, maxItems);
      results.push(...items);
      log?.info(`RSS取得成功: ${src.name}（${items.length}件）`);
    } catch (err) {
      log?.error(`RSS取得失敗: ${src.name} (${err.message})`);
    }
  }

  return results;
}
