// 新着整備品アイテム → X投稿文。
// 新規アカウントはPremium無しの可能性があるため280字以内に収める。
// t.co短縮でURLは23字固定として計算する。
const TCO = 23;
const LIMIT = 280;

const MODEL_LABEL = {
  'macbook-air': 'MacBook Air',
  'macbook-pro': 'MacBook Pro',
  'mac-mini': 'Mac mini',
  'mac-studio': 'Mac Studio',
  'mac-pro': 'Mac Pro',
  imac: 'iMac',
  display: 'ディスプレイ',
  other: 'Mac',
};

function cleanTitle(title) {
  return title
    .replace(/\s*\[整備済製品\]\s*/g, ' ')
    .replace(/整備済製品/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 文字数（URLはt.co固定長で数える）
function weighted(text, url) {
  const body = text.replace(url, '');
  return [...body].length + (text.includes(url) ? TCO : 0);
}

export function formatTweet(item, hashtags = []) {
  const tag = MODEL_LABEL[item.model] || 'Mac';
  const price = item.price ? `💰 ${item.price}` : '';
  const tags = hashtags.join(' ');
  const head = `🆕 Apple整備済製品 入荷｜${tag}`;

  let title = cleanTitle(item.title);
  const url = item.url;

  const build = (t) =>
    [head, '', t, price, url, '', tags].filter((l) => l !== null).join('\n');

  let tweet = build(title);
  // 超過分はタイトルを削る
  while (weighted(tweet, url) > LIMIT && title.length > 8) {
    title = title.slice(0, -4).trim() + '…';
    tweet = build(title);
  }
  return tweet;
}
