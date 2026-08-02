# GitHub Actions ではじめる情報収集の自動化

**毎朝、気になる情報の要約が自分のメールに届く仕組み**を、サーバーを用意せずに作ります。

MIRAICHI セミナー（2026年8月3日）の教材リポジトリです。

```text
GitHub Actions が決まった時間に動く
        ↓
RSS から新着記事を取りに行く
        ↓
生成AI が日本語で要約する
        ↓
Resend で自分のメールアドレスへ送る
        ↓
毎朝、要約が届く
```

## このリポジトリでやること・やらないこと

**やること**

- GitHub Actions を「決まった時間にプログラムを動かす仕組み」として使う
- RSS から新着記事を取得する
- 生成AI（Gemini）で日本語の要約を作る
- Resend でHTMLメールを自分宛に送る
- APIキーを GitHub Secrets で安全に管理する

**やらないこと**

このセミナーでは、GitHub Actions の CI/CD（テスト自動化・ビルド・デプロイ）は扱いません。エンジニア向けの詳しい使い方ではなく、**情報収集の自動化に使える定期実行の仕組み**として紹介します。

## 費用について

小規模な個人利用であれば、各サービスの無料枠を活用して始めやすい構成にしています。ただし GitHub Actions・Gemini API・Resend にはそれぞれ利用条件と上限があります。**「完全無料」「無制限で無料」ではありません。**利用前に各サービスの最新の条件を確認してください。

## 必要なもの

| 項目 | 用途 |
|---|---|
| GitHub アカウント | このリポジトリをフォークして動かす |
| メールアドレス | 要約の受け取り先 |
| Gemini API キー | 記事の要約 |
| Resend アカウント + APIキー | メールの送信 |

## 使い方

まずは **[docs/setup-guide.md](docs/setup-guide.md)** を上から順にやってください。

- [docs/setup-guide.md](docs/setup-guide.md) — 最初にやること（キーの取得から Secrets 登録まで）
- [docs/github-actions-overview.md](docs/github-actions-overview.md) — GitHub Actions の概要（4つだけ覚えれば動かせます）
- [docs/resend-setup.md](docs/resend-setup.md) — Resend の設定
- [docs/troubleshooting.md](docs/troubleshooting.md) — うまくいかないときの確認ポイント

## 変更するのはこの5つだけ

コードを書き換える必要はありません。触るのは次の5つです。

1. 集める情報源（RSSのURL） — `config/sources.json`
2. 1回に取得する件数 — `config/settings.json`
3. 送信先のメールアドレス — GitHub Secrets
4. 実行する時刻 — `.github/workflows/daily-digest.yml`
5. APIキー — GitHub Secrets

## ローカルで試す（任意・開発者向け）

```bash
npm install
npm run verify   # ユニットテスト + dry-run（メールは送信されません）
```

## 講師

けいたろう（keitaro GAS Lab）

## ライセンス

セミナー配布用のサンプルです。各自の環境に合わせて自由に調整してください。
