// 要約済みアイテムから、デイリーダイジェストメールの件名・HTML本文・テキスト本文を組み立てる。
// 0件のときの送信スキップ判定はこのモジュールの責務ではなく、呼び出し側（index.js）が行う。

import { formatDateJa, escapeHtml } from "../utils/format.js";

// 情報源（source）ごとにグルーピングする。順序はitemsに現れた順を維持する。
function groupBySource(items) {
  const order = [];
  const map = new Map();
  for (const item of items) {
    const key = item.source || "その他";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(item);
  }
  return order.map((source) => ({ source, items: map.get(source) }));
}

function buildHtml(itemsWithSummary, subject) {
  const groups = groupBySource(itemsWithSummary);

  const groupsHtml = groups
    .map((group) => {
      const articlesHtml = group.items
        .map((item) => {
          const summaryHtml = escapeHtml(item.summary || "").replace(/\n/g, "<br>");
          return `
        <div style="margin:0 0 16px 0; padding-bottom:16px; border-bottom:1px solid #eeeeee;">
          <p style="margin:0 0 8px 0; font-size:16px; font-weight:bold;">
            <a href="${escapeHtml(item.url)}" style="color:#1a73e8; text-decoration:none;">${escapeHtml(item.title)}</a>
          </p>
          <p style="margin:0 0 8px 0; font-size:14px; line-height:1.6; color:#333333;">${summaryHtml}</p>
          <p style="margin:0; font-size:12px; color:#666666;">${escapeHtml(item.url)}</p>
        </div>`;
        })
        .join("");

      return `
      <div style="margin:0 0 24px 0;">
        <h2 style="font-size:18px; border-left:4px solid #1a73e8; padding-left:8px; margin:0 0 16px 0;">${escapeHtml(group.source)}</h2>
        ${articlesHtml}
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; color:#111111; margin:0; padding:16px; background-color:#ffffff;">
  <h1 style="font-size:20px; margin:0 0 24px 0;">${escapeHtml(subject)}</h1>
  ${groupsHtml}
</body>
</html>`;
}

function buildText(itemsWithSummary, subject) {
  const groups = groupBySource(itemsWithSummary);

  const groupsText = groups
    .map((group) => {
      const articlesText = group.items
        .map((item) => `・${item.title}\n${item.summary || ""}\n${item.url}\n`)
        .join("\n");
      return `【${group.source}】\n${articlesText}`;
    })
    .join("\n");

  return `${subject}\n\n${groupsText}`;
}

// itemsWithSummary（summary付きの共通アイテム形式配列）とdateから、
// { subject, html, text } を組み立てて返す。
export function buildDigestEmail(itemsWithSummary, date) {
  const subject = `【AI情報収集】${formatDateJa(date)}のデイリーダイジェスト`;
  return {
    subject,
    html: buildHtml(itemsWithSummary, subject),
    text: buildText(itemsWithSummary, subject),
  };
}
