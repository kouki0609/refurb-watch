// Apple JP 整備済製品(refurbished) の在庫を全件取得する。
// Appleのグリッドはサーバーが先頭30件しか返さず、続きはJS内部fetch(難読化)で
// ページングされる。仕様変更に強くするため、ヘッドレスブラウザでページを実際に
// 最後まで開いて、描画された全タイルを読む方式にする。
import { chromium } from 'playwright';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// 監視対象カテゴリ。必要に応じて ipad / iphone 等を足せる。
const CATEGORIES = [{ key: 'mac', url: 'https://www.apple.com/jp/shop/refurbished/mac' }];

// タイトル文字列からモデル種別を推定（フィルタ用）。
function detectModel(title) {
  if (/MacBook\s*Air/i.test(title)) return 'macbook-air';
  if (/MacBook\s*Pro/i.test(title)) return 'macbook-pro';
  if (/Mac\s*mini/i.test(title)) return 'mac-mini';
  if (/Mac\s*Studio/i.test(title)) return 'mac-studio';
  if (/Mac\s*Pro/i.test(title)) return 'mac-pro';
  if (/iMac/i.test(title)) return 'imac';
  if (/Studio\s*Display|Pro\s*Display/i.test(title)) return 'display';
  return 'other';
}

// 1カテゴリのページを開き、続きを全部ロードしてから全タイルを抽出する。
async function fetchCategory(page, cat) {
  await page.goto(cat.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // 商品リンク(/shop/product/<partno>/a/...)が出るまで待つ。ハイドレーション待ち。
  try {
    await page.waitForSelector('a[href*="/shop/product/"]', { timeout: 30000 });
  } catch {
    // 0件カテゴリ or 構造変化。後続の抽出で空配列を返す。
  }

  // 「もっと見る/さらに表示」を押す or スクロールして、件数が安定するまでループ。
  let stable = 0;
  let prevCount = -1;
  for (let i = 0; i < 50 && stable < 3; i++) {
    const count = await page.evaluate(
      () => document.querySelectorAll('a[href*="/shop/product/"]').length
    );
    if (count === prevCount) stable++;
    else stable = 0;
    prevCount = count;

    // load-more ボタン候補をテキストで探してクリック。
    const clicked = await page.evaluate(() => {
      const re = /もっと見る|さらに表示|もっと読み込む|表示を増やす|load\s*more|show\s*more/i;
      const btns = Array.from(document.querySelectorAll('button, a[role="button"]'));
      const b = btns.find((el) => re.test((el.textContent || '').trim()) && el.offsetParent !== null);
      if (b) { b.click(); return true; }
      return false;
    });
    if (!clicked) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }
    await page.waitForTimeout(900);
  }

  // 全タイルを抽出。商品リンクを起点に、最寄りの祖先から価格テキストを拾う。
  const items = await page.evaluate(() => {
    const seen = new Map();
    const links = Array.from(document.querySelectorAll('a[href*="/shop/product/"]'));
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      // /jp/shop/product/<part1>/<part2>/... → partNumber = PART1/PART2 (大文字化)
      const m = href.match(/\/shop\/product\/([a-z0-9]+)\/([a-z0-9]+)\//i);
      if (!m) continue;
      const partNumber = (m[1] + '/' + m[2]).toUpperCase();

      const title = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (!title) continue; // 画像だけのリンクは捨てる(同一商品のテキストリンクを採用)
      if (!/整備済/.test(title)) continue; // クロスセル(「○○を購入」)等の非整備品リンクを除外

      // 価格: 祖先を数階層さかのぼり "X円" を含む最初のテキストから抽出。
      let price = '';
      let raw = null;
      let node = a;
      for (let up = 0; up < 6 && node; up++) {
        const t = node.textContent || '';
        const pm = t.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*円/);
        if (pm) {
          price = pm[1] + '円';
          raw = parseInt(pm[1].replace(/,/g, ''), 10);
          break;
        }
        node = node.parentElement;
      }

      // ?fnode=... のトラッキング文字列を落としてクリーンなベースURLにする
      const path = href.split('?')[0];
      const url = path.startsWith('http') ? path : 'https://www.apple.com' + path;
      const prev = seen.get(partNumber);
      // 同一partNumberはタイトルが長い(=詳細)方／価格付きを優先。
      if (!prev || (raw && !prev.raw) || title.length > prev.title.length) {
        seen.set(partNumber, { partNumber, title, price, raw, url });
      }
    }
    return Array.from(seen.values());
  });

  return items.map((it) => ({ ...it, model: detectModel(it.title), category: cat.key }));
}

export async function fetchAllRefurb() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, locale: 'ja-JP' });
  const page = await ctx.newPage();
  const all = [];
  try {
    for (const cat of CATEGORIES) {
      const items = await fetchCategory(page, cat);
      all.push(...items);
    }
  } finally {
    await browser.close();
  }
  // partNumberで最終de-dup
  const map = new Map();
  for (const it of all) if (!map.has(it.partNumber)) map.set(it.partNumber, it);
  return Array.from(map.values());
}

// 直接実行された場合は取得して標準出力にJSONを出す（実証・デバッグ用）。
if (import.meta.url === `file://${process.argv[1]}`) {
  const items = await fetchAllRefurb();
  const byModel = items.reduce((a, x) => ((a[x.model] = (a[x.model] || 0) + 1), a), {});
  console.error('total:', items.length, 'byModel:', JSON.stringify(byModel));
  console.log(JSON.stringify(items, null, 2));
}
