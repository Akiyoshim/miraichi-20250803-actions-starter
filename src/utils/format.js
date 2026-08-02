// 日付の整形・文字列トリム・HTMLエスケープなど、共通で使う小さな関数をまとめたもの。
// どの関数も落ちない（変な入力でも例外を投げず、無難な値を返す）ことを優先している。

// Date → "2026年8月3日" の形式に変換する
export function formatDateJa(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}年${m}月${d}日`;
}

// 日付らしき値（Date / 文字列 / それ以外）を "YYYY-MM-DD" に変換する。
// 解釈できない場合は空文字を返し、呼び出し側を落とさない。
export function formatDateIso(v) {
  if (!v) return "";
  const date = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 文字列を maxLength 文字に切り詰める。超過した場合は末尾に「…」を付ける。
export function truncate(text, maxLength) {
  if (!text) return "";
  const str = String(text);
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…`;
}

// HTMLに埋め込むためのエスケープ処理（& < > " ' の5文字）
export function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
