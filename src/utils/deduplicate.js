// 同じ記事を毎日重複してメールしないための重複排除ユーティリティ。
// data/processed-items.json に「送信済みURL一覧」を保存し、次回実行時に突合する。

import fs from "node:fs";

// 比較用にURLを正規化する。
// ハッシュ(#...)を除去し、末尾スラッシュを除去し、utm_*などの計測用パラメータを除去し、
// ホスト名を小文字にする。これにより見た目違いのURLを同一記事として扱えるようにする。
export function normalizeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.hash = "";
    // トラッキング系パラメータを除去する
    const trackingPrefixes = ["utm_"];
    const trackingExact = ["gclid", "fbclid", "ref", "ref_src"];
    for (const key of [...u.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (
        trackingPrefixes.some((p) => lower.startsWith(p)) ||
        trackingExact.includes(lower)
      ) {
        u.searchParams.delete(key);
      }
    }
    u.hostname = u.hostname.toLowerCase();
    let pathname = u.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    const search = u.searchParams.toString();
    return `${u.protocol}//${u.hostname}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    // URLとして解釈できない場合は、そのままの文字列を使う（落とさない）
    return String(url);
  }
}

// 処理済みアイテムのJSONを読み込む。
// ファイルが無い・壊れている場合は警告を出し、空の状態を返す（落ちない）。
export function loadProcessed(filePath, log) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) {
      log?.warn(`processed-itemsの形式が不正です: ${filePath}`);
      return { items: [] };
    }
    return parsed;
  } catch (err) {
    log?.warn(`processed-itemsの読み込みに失敗しました（空として扱います）: ${err.message}`);
    return { items: [] };
  }
}

// items のうち、processed に未登録（URL正規化して比較）のものだけを返す
export function filterNew(items, processed) {
  const processedUrls = new Set(
    (processed?.items ?? []).map((i) => normalizeUrl(i.url))
  );
  return items.filter((item) => !processedUrls.has(normalizeUrl(item.url)));
}

// 新しいアイテムを processed に積み、新しい順に limit 件まで切り詰めた新しいオブジェクトを返す
// （元の processed オブジェクトは変更しない）
export function addProcessed(items, processed, limit = 500) {
  const newRecords = items.map((item) => ({
    url: item.url,
    title: item.title,
    processedAt: new Date().toISOString(),
  }));
  const merged = [...newRecords, ...(processed?.items ?? [])];
  return { items: merged.slice(0, limit) };
}

// processed を JSON ファイルに保存する
export function saveProcessed(filePath, processed) {
  fs.writeFileSync(filePath, JSON.stringify(processed, null, 2));
}
