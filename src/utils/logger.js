// GitHub Actions のログで「何が・どこで」起きたかすぐ追えるようにするための、素朴なロガー。
// console.log/warn/error にプレフィックスを付けて出すだけ。凝ったことはしない。

export const logger = {
  info(...args) {
    console.log("[INFO]", ...args);
  },
  warn(...args) {
    console.warn("[WARN]", ...args);
  },
  error(...args) {
    console.error("[ERROR]", ...args);
  },
};
