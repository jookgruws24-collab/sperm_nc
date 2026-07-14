import { weaponTypes } from "./config.js";
import { annotateRankScope, mergeRankingRows } from "./ranking.js";

// Client-side cache shared by every view (ranking + both compare panels).
// A dataset is fetched at most once per (rankingType, regionCode) per session.
const cache = new Map();

async function fetchBatch(rankingType, regionCode, { weaponTypeCodes, includeGlobal } = {}) {
  const params = new URLSearchParams({ rankingType, regionCode });
  if (weaponTypeCodes?.length === 1) params.set("weaponType", weaponTypeCodes[0]);
  if (weaponTypeCodes?.length > 1) params.set("weaponTypes", weaponTypeCodes.join(","));
  if (includeGlobal) params.set("includeGlobal", "1");

  const response = await fetch(`/api/ranking?${params.toString()}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function annotateItems(data) {
  return (Array.isArray(data.items) ? data.items : []).map((row) =>
    annotateRankScope(row, row.sourceScope || "class", row.sourceTotalCount || data.totalCount)
  );
}

/**
 * Progressive loader:
 * 1. Fetches the global top 1,000 first (1 small request) and reports it
 *    via onPartial so the UI can render almost immediately.
 * 2. Fetches all class rankings in one batched request, merges, and resolves.
 */
export function loadRanking(rankingType, regionCode, { onPartial } = {}) {
  const key = `${rankingType}:${regionCode}`;
  const cached = cache.get(key);

  if (cached) {
    if (!cached.complete && cached.rows && onPartial) onPartial(cached.rows);
    return cached.promise;
  }

  const entry = { rows: null, complete: false };
  entry.promise = (async () => {
    const globalData = await fetchBatch(rankingType, regionCode, { includeGlobal: true, weaponTypeCodes: [] });
    const globalRows = annotateItems(globalData);
    entry.rows = mergeRankingRows(globalRows);
    onPartial?.(entry.rows);

    const classData = await fetchBatch(rankingType, regionCode, {
      weaponTypeCodes: weaponTypes.map((weaponType) => weaponType.code),
    });
    entry.rows = mergeRankingRows([...globalRows, ...annotateItems(classData)]);
    entry.complete = true;
    return entry.rows;
  })();

  cache.set(key, entry);
  entry.promise.catch(() => cache.delete(key));
  return entry.promise;
}
