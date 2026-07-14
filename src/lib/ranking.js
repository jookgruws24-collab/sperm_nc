import { weaponTypeOrder } from "./config.js";

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

export function sortRowsForView(rows, classFilter) {
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

export function getClassRankingWarningIndex(rows, classFilter) {
  if (classFilter) return -1;
  return rows.findIndex((row) => !Number.isFinite(row.globalRanking));
}

export function getRankValue(row, classFilter) {
  if (classFilter) return row.classRanking ?? row.ranking;
  return row.globalRanking ?? row.classRanking ?? row.ranking;
}

export function getFlucType(row, classFilter) {
  if (classFilter) return row.classFluctuationType ?? row.fluctuationType;
  return row.globalFluctuationType ?? row.classFluctuationType ?? row.fluctuationType;
}

export function getFlucValue(row, classFilter) {
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

export function annotateRankScope(row, scope, totalCount) {
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
