// X(API v2)への投稿。twitter-api-v2 を使い、環境変数でキーを注入する。
// 必要なenv: X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
// DRY_RUN=1 で投稿せず内容だけ表示。
import { TwitterApi } from 'twitter-api-v2';

function getClient() {
  const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    throw new Error('X APIキーが未設定です（X_APP_KEY/X_APP_SECRET/X_ACCESS_TOKEN/X_ACCESS_SECRET）');
  }
  return new TwitterApi({
    appKey: X_APP_KEY,
    appSecret: X_APP_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  }).readWrite;
}

// tweets: string[]。順番に投稿する。dryRunならログのみ。
export async function postTweets(tweets, { dryRun = false } = {}) {
  if (!tweets.length) return [];
  if (dryRun) {
    tweets.forEach((t, i) => {
      console.log(`\n--- DRY RUN tweet ${i + 1} ---\n${t}`);
    });
    return tweets.map(() => ({ dryRun: true }));
  }
  const client = getClient();
  const results = [];
  for (const text of tweets) {
    try {
      const r = await client.v2.tweet(text);
      results.push({ id: r.data?.id });
      console.log('posted:', r.data?.id);
    } catch (e) {
      console.error('post failed:', e?.data?.detail || e.message);
      results.push({ error: e?.data?.detail || e.message });
    }
    // レート/重複対策で少し間隔を空ける
    await new Promise((res) => setTimeout(res, 2000));
  }
  return results;
}
