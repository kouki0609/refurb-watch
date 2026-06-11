// 在庫スナップショットの永続化と差分検出。
// seen.json に { partNumber: { firstSeen, lastSeen, raw, title } } を持ち、
// 今回取得分と突き合わせて「新着(初登場)」を返す。
import { readFile, writeFile } from 'fs/promises';

const STATE_PATH = new URL('../seen.json', import.meta.url);

export async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf-8'));
  } catch {
    return {}; // 初回
  }
}

export async function saveState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

// items: fetchAllRefurb() の結果。nowIso: 実行時刻。
// 戻り値 { newItems, priceDrops, state } 。
export function diff(state, items, nowIso) {
  const newItems = [];
  const priceDrops = [];
  for (const it of items) {
    const prev = state[it.partNumber];
    if (!prev) {
      newItems.push(it);
      state[it.partNumber] = {
        firstSeen: nowIso,
        lastSeen: nowIso,
        raw: it.raw,
        title: it.title,
      };
    } else {
      if (it.raw && prev.raw && it.raw < prev.raw) {
        priceDrops.push({ ...it, prevRaw: prev.raw });
      }
      prev.lastSeen = nowIso;
      if (it.raw) prev.raw = it.raw;
    }
  }
  return { newItems, priceDrops, state };
}

// 在庫から長期間消えたエントリの掃除（状態肥大化防止）。
export function prune(state, items, nowIso, days = 30) {
  const live = new Set(items.map((i) => i.partNumber));
  const cutoff = new Date(nowIso).getTime() - days * 86400000;
  for (const [pn, v] of Object.entries(state)) {
    if (!live.has(pn) && new Date(v.lastSeen).getTime() < cutoff) {
      delete state[pn];
    }
  }
  return state;
}
