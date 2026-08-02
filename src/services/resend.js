// Resend APIでダイジェストメールを送信するサービス。
// dryRun=true のときは送信せず、送信しなかったことをログに残すだけ。

// { subject, html, text } を送る。options: { dryRun, env, log }
export async function sendDigestEmail({ subject, html, text }, options = {}) {
  const { dryRun, env = {}, log } = options;

  if (dryRun) {
    log?.info("ドライランのため送信しません");
    return { skipped: true };
  }

  // 実送信のときだけSDKを読み込む（dry-run経路でSDKの初期化に依存しないようにするため）
  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: env.EMAIL_TO,
    subject,
    html,
    text,
  });

  if (error) {
    // エラーメッセージはResendが返したものをそのまま使う（APIキーは含まれない想定）
    throw new Error(`メール送信に失敗しました: ${error.message || JSON.stringify(error)}`);
  }

  return data;
}
