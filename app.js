const fields = ["ranking", "character", "class", "server", "guild", "union"];
const state = {
  rows: [],
  filters: Object.fromEntries(fields.map((field) => [field, ""])),
  regionCode: "0",
  currentPage: 1,
};
const regionCache = new Map();
const totalPages = 10;
const maxConcurrentLoads = 4;
const rowsPerPage = 1000;
const weaponTypes = [
  { code: "13", name: "One-handed Sword" },
  { code: "12", name: "Twin Sword" },
  { code: "31", name: "Staff" },
  { code: "32", name: "Wand" },
  { code: "33", name: "Orb" },
  { code: "11", name: "Two-handed Sword" },
  { code: "14", name: "Spear" },
  { code: "21", name: "Bow" },
  { code: "22", name: "Dagger" },
  { code: "23", name: "Rapier" },
  { code: "15", name: "Cannon" },
];
const weaponTypeOrder = new Map(weaponTypes.map((weaponType, index) => [Number(weaponType.code), index]));

const body = document.querySelector("#rankingBody");
const visibleCount = document.querySelector("#visibleCount");
const regionSelect = document.querySelector("#regionSelect");
const prevPage = document.querySelector("#prevPage");
const nextPage = document.querySelector("#nextPage");
const pageInfo = document.querySelector("#pageInfo");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingPercent = document.querySelector("#loadingPercent");
const loadingBarFill = document.querySelector("#loadingBarFill");
const loadingMessage = document.querySelector("#loadingMessage");
const filterInputs = Object.fromEntries(
  fields.map((field) => [field, document.querySelector(`#filter-${field}`)])
);
let activeLoadId = 0;

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function flucLabel(row) {
  const type = getFlucType(row);
  const value = getFlucValue(row);
  if (type === "up") return `▲ ${value}`;
  if (type === "down") return `▼ ${value}`;
  return value || "-";
}

function matchesFilters(row) {
  return fields.every((field) => {
    const query = state.filters[field];
    if (!query) return true;
    if (field === "class") return row.class === query;
    return normalize(row[field]).includes(query);
  });
}

function render() {
  const rows = sortRowsForView(state.rows.filter(matchesFilters));
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  state.currentPage = Math.min(Math.max(1, state.currentPage), pageCount);
  const start = (state.currentPage - 1) * rowsPerPage;
  const pageRows = rows.slice(start, start + rowsPerPage);
  const warningIndex = getClassRankingWarningIndex(rows);

  visibleCount.textContent = rows.length.toLocaleString();
  document.querySelector("#rankHeader").textContent = state.filters.class ? "Class Ranking" : "Ranking";
  renderPagination(pageCount);

  if (!pageRows.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty">No matching data</td></tr>';
    return;
  }

  body.innerHTML = pageRows
    .map((row, index) => {
      const absoluteIndex = start + index;
      const warningRow =
        absoluteIndex === warningIndex
          ? `
            <tr class="ranking-warning">
              <td colspan="8">
                From No. ${(warningIndex + 1).toLocaleString()} onward, rows use normalized class ranking because the official global ranking is only available for the top 1,000.
              </td>
            </tr>
          `
          : "";

      return `
        ${warningRow}
        <tr>
          <td>${(absoluteIndex + 1).toLocaleString()}</td>
          <td>
            <div class="rank-area">
              <div class="rank" data-rank="${getRankValue(row)}">
                <div class="value">${getRankValue(row)}</div>
              </div>
              <div class="fluc ${getFlucType(row)}">${flucLabel(row)}</div>
            </div>
          </td>
          <td>${escapeHtml(row.character)}</td>
          <td>${escapeHtml(row.class)}</td>
          <td>${escapeHtml(row.server)}</td>
          <td>${escapeHtml(row.guild)}</td>
          <td>${escapeHtml(row.union)}</td>
          <td>${escapeHtml(formatDate(row.maxRankDate))}</td>
        </tr>
      `;
    })
    .join("");
}

function renderPagination(pageCount) {
  pageInfo.textContent = `Page ${state.currentPage.toLocaleString()} of ${pageCount.toLocaleString()}`;
  prevPage.disabled = state.currentPage <= 1;
  nextPage.disabled = state.currentPage >= pageCount;
}

function renderClassOptions() {
  const classSelect = filterInputs.class;
  const current = state.filters.class;
  const availableClasses = new Set(state.rows.map((row) => row.class).filter(Boolean));
  const classes = weaponTypes.map((weaponType) => weaponType.name).filter((className) => availableClasses.has(className));

  classSelect.innerHTML = [
    '<option value="">All</option>',
    ...classes.map((className) => `<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`),
  ].join("");

  if (classes.includes(current)) {
    classSelect.value = current;
  } else {
    state.filters.class = "";
  }
}

function formatDate(value) {
  if (!value) return "";
  const text = String(value);
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (isoMatch) return `${isoMatch[1]} ${isoMatch[2]}`;

  const usMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
  if (usMatch) return `${usMatch[3]}-${usMatch[1]}-${usMatch[2]} ${usMatch[4]}`;

  return text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindFilters() {
  for (const field of fields) {
    const eventName = filterInputs[field].tagName === "SELECT" ? "change" : "input";
    filterInputs[field].addEventListener(eventName, (event) => {
      state.filters[field] = field === "class" ? event.target.value : normalize(event.target.value);
      state.currentPage = 1;
      render();
    });
  }

  regionSelect.addEventListener("change", () => {
    state.regionCode = regionSelect.value;
    state.currentPage = 1;
    loadData();
  });

  prevPage.addEventListener("click", () => {
    state.currentPage -= 1;
    render();
  });

  nextPage.addEventListener("click", () => {
    state.currentPage += 1;
    render();
  });
}

function setLoading(percent, message) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  loadingOverlay.hidden = false;
  loadingPercent.textContent = `${value}%`;
  loadingBarFill.style.width = `${value}%`;
  loadingMessage.textContent = message;
}

function hideLoading() {
  loadingOverlay.hidden = true;
}

async function loadData() {
  const loadId = (activeLoadId += 1);
  const cachedRows = regionCache.get(state.regionCode);

  if (cachedRows) {
    state.rows = cachedRows;
    renderClassOptions();
    render();
    setLoading(0, "Refreshing cached data...");
  } else {
    body.innerHTML = '<tr><td colspan="8" class="empty">Loading ranking data...</td></tr>';
    visibleCount.textContent = "0";
    setLoading(0, "Preparing request...");
  }

  try {
    const rows = await loadPagesWithLimit(state.regionCode, (loadedPages, loadedRows) => {
      if (loadId !== activeLoadId) return;
      setLoading(
        (loadedPages / totalLoadTasks()) * 100,
        `Loaded ${loadedPages} of ${totalLoadTasks()} requests (${loadedRows.toLocaleString()} rows)...`
      );
    });

    if (loadId !== activeLoadId) return;
    const mergedRows = mergeRankingRows(rows);
    regionCache.set(state.regionCode, mergedRows);
    state.rows = mergedRows;
    state.currentPage = 1;
    renderClassOptions();
    render();
    setLoading(100, "Done");
    window.setTimeout(() => {
      if (loadId === activeLoadId) hideLoading();
    }, 250);
  } catch (error) {
    hideLoading();
    body.innerHTML = `
      <tr>
        <td colspan="8" class="empty">
          Could not load ranking data from Night Crows.
        </td>
      </tr>
    `;
    console.error(error);
  }
}

async function loadPagesWithLimit(regionCode, onProgress) {
  const globalTasks = Array.from({ length: totalPages }, (_, index) => ({
    page: index + 1,
    weaponType: null,
    scope: "global",
  }));
  const classTasks = weaponTypes.flatMap((weaponType) =>
    Array.from({ length: totalPages }, (_, index) => ({
      page: index + 1,
      weaponType,
      scope: "class",
    }))
  );
  const tasks = [...globalTasks, ...classTasks];
  const results = new Array(tasks.length);
  let nextIndex = 0;
  let loadedTasks = 0;
  let loadedRows = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex;
      const task = tasks[taskIndex];
      nextIndex += 1;

      const data = await fetchRankingPage(regionCode, task.page, task.weaponType?.code);
      const items = (Array.isArray(data.items) ? data.items : []).map((row) =>
        annotateRankScope(row, task.scope, data.totalCount)
      );
      results[taskIndex] = items;
      loadedTasks += 1;
      loadedRows += items.length;
      onProgress(loadedTasks, loadedRows);
    }
  }

  const workerCount = Math.min(maxConcurrentLoads, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results.flat();
}

async function fetchRankingPage(regionCode, page, weaponType) {
  const params = new URLSearchParams({ regionCode, page: String(page) });
  if (weaponType) params.set("weaponType", weaponType);
  const response = await fetch(`/api/ranking-page?${params.toString()}`, { cache: "no-store" });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function totalLoadTasks() {
  return (weaponTypes.length + 1) * totalPages;
}

function mergeRankingRows(rows) {
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

function sortRowsForView(rows) {
  if (state.filters.class) {
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

function getNormalizedClassRank(row, rows) {
  const denominator = row.classTotalCount || getVisibleClassCount(row.classCode, rows) || 1;
  return (row.classRanking ?? row.ranking) / denominator;
}

function getVisibleClassCount(classCode, rows) {
  return rows.reduce((count, row) => count + (row.classCode === classCode ? 1 : 0), 0);
}

function getClassRankingWarningIndex(rows) {
  if (state.filters.class) return -1;
  return rows.findIndex((row) => !Number.isFinite(row.globalRanking));
}

function getRankValue(row) {
  if (state.filters.class) return row.classRanking ?? row.ranking;
  return row.globalRanking ?? row.classRanking ?? row.ranking;
}

function getFlucType(row) {
  if (state.filters.class) return row.classFluctuationType ?? row.fluctuationType;
  return row.globalFluctuationType ?? row.classFluctuationType ?? row.fluctuationType;
}

function getFlucValue(row) {
  if (state.filters.class) return row.classFluctuation ?? row.fluctuation;
  return row.globalFluctuation ?? row.classFluctuation ?? row.fluctuation;
}

bindFilters();
loadData();
