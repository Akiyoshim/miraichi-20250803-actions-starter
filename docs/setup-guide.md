# セットアップガイド（最初にやること）

この手順どおりに進めると、**毎朝あなたのメールにAIニュースの要約が届く**ようになります。
所要時間はおよそ20〜30分。コードを書く作業はありません。

必要なもの: GitHubアカウント／Googleアカウント（Gemini APIキー用）／メールアドレス

> 料金について: 小規模な個人利用なら、各サービスの無料枠を活用して始めやすい構成です。ただし条件・上限があります。詳しくは各サービスの最新情報を確認してください。

## Step 1. リポジトリを自分のアカウントにコピーする（フォーク）

1. このリポジトリのページ右上の **Fork** を押す
2. そのまま **Create fork** を押す
3. 自分のアカウントに同じ名前のリポジトリができる（以降は自分のリポジトリで作業する）

> **フォーク直後はActionsが無効になっています。** 次にやる手順4より前に、自分のリポジトリの **Actions** タブを開き、「I understand my workflows, go ahead and enable them」ボタンを押して有効化してください。ここを飛ばすと、あとで実行ボタンが出てきません。

## Step 2. Gemini APIキーを取得する

1. [Google AI Studio](https://aistudio.google.com/) を開いてGoogleアカウントでログイン
2. **Get API key** → **APIキーを作成**
3. 表示されたキー（`AIza...` で始まる文字列）をコピーして手元に控える

> APIキーはパスワードと同じです。他人に見せたり、コードに書き込んだりしないでください。

## Step 3. Resendに登録してAPIキーを取得する

1. [Resend](https://resend.com/) にサインアップ（GitHubアカウントでログイン可）
2. **API Keys** → **Create API Key** → 名前は自由（例: `daily-digest`）
3. 表示されたキー（`re_...` で始まる文字列）をコピーして控える

送信元アドレスは、独自ドメインを設定していない間は `onboarding@resend.dev` が使えます。独自ドメインの検証は任意です（詳しくは [docs/resend-setup.md](resend-setup.md)）。

## Step 4. GitHub Secretsに4つ登録する

1. 自分のリポジトリで **Settings → Secrets and variables → Actions** を開く
2. **New repository secret** から次の4つを1つずつ登録する

| Name（正確に入力） | Secret（値） |
|---|---|
| `GEMINI_API_KEY` | Step 2 のキー |
| `RESEND_API_KEY` | Step 3 のキー |
| `EMAIL_FROM` | `onboarding@resend.dev` |
| `EMAIL_TO` | 自分のメールアドレス |

> Name はコピー&ペースト推奨。1文字でも違うと動きません。

## Step 5. Actionsを手動実行する

1. リポジトリの **Actions** タブを開く
2. 左の一覧から **daily-digest** を選ぶ
3. 右側の **Run workflow ▼** → 緑の **Run workflow** を押す
4. 1〜2分待つと実行が完了し、緑のチェック✓になる

## Step 6. メールを確認する

自分のメールを確認します。「【AI情報収集】…のデイリーダイジェスト」という件名のメールが届いていたら完成です。

届かない・赤い×になったときは [docs/troubleshooting.md](troubleshooting.md) を見てください。

## そのあと自分好みにカスタマイズする

### 収集するRSSを変える

`config/sources.json` をGitHubの画面で編集（鉛筆アイコン）します。

```json
{
  "rss": [
    { "name": "好きなブログ", "url": "https://example.com/rss" }
  ]
}
```

RSSのURLは、サイト名 +「RSS」で検索すると見つかることが多いです。noteのクリエイターは `https://note.com/ユーザー名/rss` で取得できます。

### 取得件数を変える

`config/settings.json` の `maxItems` を書き換えます。

### 届く時刻を変える

`.github/workflows/daily-digest.yml` の cron を書き換えます。詳しくは [docs/github-actions-overview.md](github-actions-overview.md) を参照してください。
