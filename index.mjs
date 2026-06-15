// オーケストレーター: 取得 → 差分 → 絞り込み → X投稿 → 状態保存。
// 実行: node index.mjs   (DRY_RUN=1 で投稿せず確認)
import { readFile } from 'fs/promises';
import { fetchAllRefurb } from './src/fetch.mjs';
import { loadState, saveState, diff, prune } from './src/state.mjs';
import { applyWatch } from './src/filter.mjs';
import { formatTweet } from './src/format.mjs';
import { postTweets } from './src/post.mjs';

const cfg = JSON.parse(await readFile(new URL('./config.json', import.meta.url), 'utf-8'));
const nowIso = new Date().toISOString();
// X APIキーが未設定なら投稿はスキップ（在庫追跡は継続）。キー登録後に自動で投稿開始。
const hasXKeys =
  process.env.X_APP_KEY &&
  process.env.X_APP_SECRET &&
  process.env.X_ACCESS_TOKEN &&
  process.env.X_ACCESS_SECRET;
if (!hasXKeys) console.error('※ X APIキー未設定: 投稿はスキップし状態のみ更新します。');
const dryRun = process.env.DRY_RUN === '1' || cfg.post.dryRun || !hasXKeys;

console.error(`[${nowIso}] fetching refurb…`);
const items = await fetchAllRefurb();
const byModel = items.reduce((a, x) => ((a[x.model] = (a[x.model] || 0) + 1), a), {});
console.error(`fetched ${items.length} items:`, JSON.stringify(byModel));

if (items.length === 0) {
  console.error('0件取得。Apple側の構造変化かネットワーク障害の可能性。状態は更新しない。');
  process.exit(1);
}

const state = await loadState();
const isFirstRun = Object.keys(state).length === 0;
const { newItems } = diff(state, items, nowIso);
prune(state, items, nowIso);

let toPost = applyWatch(newItems, cfg.watch);

if (isFirstRun) {
  // 初回は全在庫が「新着」になり大量投稿してしまうため、投稿せず状態だけ作る。
  console.error(`初回実行: 在庫 ${items.length} 件をベースラインとして記録（投稿しません）。`);
  await saveState(state);
  console.error('ベースライン保存完了。次回以降の新着のみ投稿します。');
  process.exit(0);
}

console.error(`新着 ${newItems.length} 件 / 投稿対象(絞り込み後) ${toPost.length} 件`);
toPost = toPost.slice(0, cfg.post.maxPostsPerRun);

const tweets = toPost.map((it) => formatTweet(it, cfg.post.hashtags));
await postTweets(tweets, { dryRun });

await saveState(state);
console.error('done.');
