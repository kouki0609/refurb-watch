// config.watch のルールで新着アイテムを絞り込む。
export function applyWatch(items, watch) {
  const models = new Set(watch.models || []);
  return items.filter((it) => {
    if (models.size && !models.has(it.model)) return false;
    if (watch.maxPriceYen && it.raw && it.raw > watch.maxPriceYen) return false;
    const t = it.title || '';
    if ((watch.titleIncludes || []).length && !watch.titleIncludes.some((k) => t.includes(k)))
      return false;
    if ((watch.titleExcludes || []).some((k) => t.includes(k))) return false;
    return true;
  });
}
