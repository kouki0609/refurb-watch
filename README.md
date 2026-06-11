# refurb-watch — Apple整備済製品(JP) 在庫ウォッチャー → X自動投稿

Apple日本の[Mac整備済製品](https://www.apple.com/jp/shop/refurbished/mac)ページを
定期巡回し、**新しく入荷した整備品を検出したらXに自動投稿**するbot。

整備品は機種・スペックごとに不定期で入荷してすぐ消える。手動で何度もページを
見張る代わりに、GitHub Actionsが20分おきに見張って新着だけ知らせる。

- 取得: ヘッドレスChromium(Playwright)でページを実際に開き、全タイルを抽出
- 検出: `seen.json` に記録した型番(partNumber)との差分で「新着」を判定
- 投稿: X API v2 (twitter-api-v2)
- ホスティング: GitHub Actions cron（**公開リポジトリなら無料・常時稼働**）
- 月額コスト: **¥0**

## 仕組み

```
GitHub Actions(20分毎)
  └ node index.mjs
      ├ src/fetch.mjs    Playwrightで整備品Macを全件取得
      ├ src/state.mjs    seen.jsonと差分 → 新着抽出
      ├ src/filter.mjs   config.jsonのモデル/価格条件で絞り込み
      ├ src/format.mjs   投稿文を生成(280字以内)
      └ src/post.mjs     Xへ投稿
  └ seen.json をcommit back（次回の基準）
```

初回実行は在庫全部が「新着」になるため、**投稿せずベースラインだけ記録**する安全設計。

## ローカルで試す

```bash
npm install
npx playwright install chromium chromium-headless-shell

# 取得だけ（投稿しない）
npm run fetch

# パイプライン全体を投稿せず確認
npm run dry
```

## 設定（config.json）

```json
{
  "watch": {
    "models": ["macbook-air", "macbook-pro", "mac-mini", "mac-studio", "imac"],
    "maxPriceYen": null,        // 上限価格。例 200000 で20万以下のみ
    "titleIncludes": [],        // 例 ["M4"] でM4機のみ
    "titleExcludes": []
  },
  "post": { "maxPostsPerRun": 4, "dryRun": false, "hashtags": ["#Apple整備済製品", "#Mac整備済"] }
}
```

`models` を `["macbook-air"]` だけにすれば「Air専用ウォッチャー」になる。

## デプロイ（GitHub Actions・¥0運用）

### 1. X側の準備（ユーザー作業）
1. botを動かすXアカウントを用意（例: 整備品速報用の専用アカウント）
2. <https://developer.x.com> でアプリ作成
3. **User authentication settings** を「**Read and write**」に設定
4. 次の4つのキーを発行: API Key / API Key Secret / Access Token / Access Token Secret

### 2. GitHub側（リポジトリのSecretsに登録）
Settings → Secrets and variables → Actions → New repository secret で4つ登録:

| Secret名 | 値 |
|---|---|
| `X_APP_KEY` | API Key |
| `X_APP_SECRET` | API Key Secret |
| `X_ACCESS_TOKEN` | Access Token |
| `X_ACCESS_SECRET` | Access Token Secret |

### 3. 稼働
- `.github/workflows/watch.yml` が20分おきに自動実行
- Actionsタブの「Run workflow」で手動実行も可
- **公開リポジトリ**にするとActions無料枠が無制限（¥0運用の条件）

## 注意
- Appleの公開ページを低頻度(20分間隔)で巡回する範囲。短間隔で叩かない。
- X API無料枠の投稿上限内に収まるよう `maxPostsPerRun` で制御している。
- ページ構造が変わって0件取得になった場合は状態を更新せず終了する（誤検知防止）。
