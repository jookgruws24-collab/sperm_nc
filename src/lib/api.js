import { weaponTypes } from "./config.js";
import { annotateRankScope, mergeRankingRows } from "./ranking.js";

// Client-side cache shared by every view (ranking + both compare panels).
// A dataset is fetched at most once per (rankingType, regionCode) per session.
const cache = new Map();

// Class rankings are loaded in small chunks so each serverless invocation
// stays fast (well under Vercel's timeout) and the UI updates progressively.
const classChunks = chunk(weaponTypes.map((weaponType) => weaponType.code), 3);

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

function chunk(list, size) {
  const chunks = [];
  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }
  return chunks;
}

/**
 * Progressive loader:
 * 1. Fetches the global top 1,000 first (1 small request) and reports it
 *    via onPartial so the UI can render almost immediately.
 * 2. Fetches class rankings in parallel chunks, merging and reporting
 *    after each chunk resolves.
 */
export function loadRanking(rankingType, regionCode, { onPartial } = {}) {
  const key = `${rankingType}:${regionCode}`;
  const cached = cache.get(key);

  if (cached) {
    if (!cached.complete && cached.rows && onPartial) onPartial(cached.rows);
    return cached.promise;
  }

  const entry = { rows: null, complete: false, listeners: new Set() };
  if (onPartial) entry.listeners.add(onPartial);

  const notify = () => {
    for (const listener of entry.listeners) listener(entry.rows);
  };

  entry.promise = (async () => {
    const globalData = await fetchBatch(rankingType, regionCode, { includeGlobal: true, weaponTypeCodes: [] });
    let allRows = annotateItems(globalData);
    entry.rows = mergeRankingRows(allRows);
    notify();

    await Promise.all(
      classChunks.map(async (weaponTypeCodes) => {
        const classData = await fetchBatch(rankingType, regionCode, { weaponTypeCodes });
        allRows = [...allRows, ...annotateItems(classData)];
        entry.rows = mergeRankingRows(allRows);
        notify();
      })
    );

    entry.complete = true;
    entry.listeners.clear();
    return entry.rows;
  })();

  cache.set(key, entry);
  entry.promise.catch(() => cache.delete(key));
  return entry.promise;
}

/** Subscribe to progressive updates for an in-flight load. */
export function onRankingProgress(rankingType, regionCode, listener) {
  const entry = cache.get(`${rankingType}:${regionCode}`);
  if (entry && !entry.complete) {
    entry.listeners.add(listener);
    return () => entry.listeners.delete(listener);
  }
  return () => {};
}
