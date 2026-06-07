import { weaponTypeOrder, weaponTypes } from "./config.js";

export async function loadCompleteRankingData(rankingType, regionCode, onProgress) {
  const data = await fetchRankingBatch(
    rankingType,
    regionCode,
    weaponTypes.map((weaponType) => weaponType.code),
    { includeGlobal: true }
  );
  const items = (Array.isArray(data.items) ? data.items : []).map((row) =>
    annotateRankScope(row, row.sourceScope || "class", row.sourceTotalCount || data.totalCount)
  );
  onProgress?.(1, items.length);
  return items;
}

export async function loadGlobalPages(rankingType, regionCode, onProgress) {
  const data = await fetchRankingBatch(rankingType, regionCode);
  const items = (Array.isArray(data.items) ? data.items : []).map((row) =>
    annotateRankScope(row, "global", data.totalCount)
  );
  onProgress?.(1, items.length);
  return items;
}

export async function loadWeaponTypePages(rankingType, regionCode, weaponTypeCode, onProgress) {
  const weaponType = weaponTypes.find((item) => item.code === String(weaponTypeCode));
  if (!weaponType) return [];

  const data = await fetchRankingBatch(rankingType, regionCode, [weaponType.code]);
  const items = (Array.isArray(data.items) ? data.items : []).map((row) =>
    annotateRankScope(row, "class", row.sourceTotalCount || data.totalCount)
  );
  onProgress?.(1, items.length);
  return items;
}

export async function loadAllWeaponTypePages(rankingType, regionCode, onProgress, weaponTypeCodes) {
  const selectedWeaponTypeCodes = weaponTypeCodes?.length
    ? weaponTypeCodes
    : weaponTypes.map((weaponType) => weaponType.code);
  const data = await fetchRankingBatch(rankingType, regionCode, selectedWeaponTypeCodes);
  const items = (Array.isArray(data.items) ? data.items : []).map((row) =>
    annotateRankScope(row, "class", row.sourceTotalCount || data.totalCount)
  );
  onProgress?.(1, items.length);
  return items;
}

export async function fetchRankingPage(rankingType, regionCode, page, weaponType) {
  const params = new URLSearchParams({ rankingType, regionCode, page: String(page) });
  if (weaponType) params.set("weaponType", weaponType);
  const response = await fetch(`/api/ranking-page?${params.toString()}`, { cache: "no-store" });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function fetchRankingBatch(rankingType, regionCode, weaponTypeCodes, options = {}) {
  const params = new URLSearchParams({ rankingType, regionCode });
  if (weaponTypeCodes?.length === 1) params.set("weaponType", weaponTypeCodes[0]);
  if (weaponTypeCodes?.length > 1) params.set("weaponTypes", weaponTypeCodes.join(","));
  if (options.includeGlobal) params.set("includeGlobal", "1");
  const response = await fetch(`/api/ranking?${params.toString()}`, { cache: "no-store" });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function globalLoadTasks() {
  return 1;
}

export function weaponTypeLoadTasks() {
  return 1;
}

export function allWeaponTypeLoadTasks() {
  return 1;
}

export function completeLoadTasks() {
  return 1;
}

export function mergeRankingRows(rows) {
  const seen = new Map();

  for (const row of rows) {
    const key = [row.regionCode, row.server, row.character, row.classCode].join("|");
    if (!seen.has(key)) {
      seen.set(key, row);
    } else {
      const existing = seen.get(key);
      seen.set(key, { ...existing, ...compactRankFields(row) });
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    const classOrder = (weaponTypeOrder.get(a.classCode) ?? 999) - (weaponTypeOrder.get(b.classCode) ?? 999);
    if (classOrder) return classOrder;
    return (a.classRanking ?? a.ranking) - (b.classRanking ?? b.ranking);
  });
}

export function sortRowsForViewWithClass(rows, classFilter) {
  if (classFilter) {
    return [...rows].sort((a, b) => (a.classRanking ?? a.ranking) - (b.classRanking ?? b.ranking));
  }

  return [...rows].sort((a, b) => {
    const aHasGlobal = Number.isFinite(a.globalRanking);
    const bHasGlobal = Number.isFinite(b.globalRanking);
    if (aHasGlobal && bHasGlobal) return a.globalRanking - b.globalRanking;
    if (aHasGlobal) return -1;
    if (bHasGlobal) return 1;

    const normalizedRank = getNormalizedClassRank(a, rows) - getNormalizedClassRank(b, rows);
    if (normalizedRank) return normalizedRank;

    const classOrder = (weaponTypeOrder.get(a.classCode) ?? 999) - (weaponTypeOrder.get(b.classCode) ?? 999);
    if (classOrder) return classOrder;
    return (a.classRanking ?? a.ranking) - (b.classRanking ?? b.ranking);
  });
}

export function getClassRankingWarningIndexFor(rows, classFilter) {
  if (classFilter) return -1;
  return rows.findIndex((row) => !Number.isFinite(row.globalRanking));
}

export function getRankValueForClass(row, classFilter) {
  if (classFilter) return row.classRanking ?? row.ranking;
  return row.globalRanking ?? row.classRanking ?? row.ranking;
}

export function getFlucTypeForClass(row, classFilter) {
  if (classFilter) return row.classFluctuationType ?? row.fluctuationType;
  return row.globalFluctuationType ?? row.classFluctuationType ?? row.fluctuationType;
}

export function getFlucValueForClass(row, classFilter) {
  if (classFilter) return row.classFluctuation ?? row.fluctuation;
  return row.globalFluctuation ?? row.classFluctuation ?? row.fluctuation;
}

export function getTopRankingRows(rows) {
  return rows.filter((row) => Number.isFinite(row.globalRanking));
}

export function calculateTopRankingPower(rows) {
  return rows.reduce((power, row) => power + getTopRankingBracketScore(row.globalRanking), 0);
}

export function getTopRankingBracketScore(ranking) {
  if (!Number.isFinite(ranking) || ranking < 1 || ranking > 1000) return 0;
  return 101 - Math.ceil(ranking / 10);
}

function annotateRankScope(row, scope, totalCount) {
  if (scope === "global") {
    return {
      ...row,
      globalRanking: row.ranking,
      globalFluctuationType: row.fluctuationType,
      globalFluctuation: row.fluctuation,
    };
  }

  return {
    ...row,
    classTotalCount: Number(totalCount) || 0,
    classRanking: row.ranking,
    classFluctuationType: row.fluctuationType,
    classFluctuation: row.fluctuation,
  };
}

function compactRankFields(row) {
  const fields = {};
  for (const key of [
    "globalRanking",
    "globalFluctuationType",
    "globalFluctuation",
    "classRanking",
    "classFluctuationType",
    "classFluctuation",
    "classTotalCount",
  ]) {
    if (row[key] !== undefined) fields[key] = row[key];
  }
  return fields;
}

function getNormalizedClassRank(row, rows) {
  const denominator = row.classTotalCount || getVisibleClassCount(row.classCode, rows) || 1;
  return (row.classRanking ?? row.ranking) / denominator;
}

function getVisibleClassCount(classCode, rows) {
  return rows.reduce((count, row) => count + (row.classCode === classCode ? 1 : 0), 0);
}
