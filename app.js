import {
  compareRowsPerTable,
  rankingTypes,
  rowsPerPage,
  weaponTypes,
} from "./js/config.js";
import {
  calculateTopRankingPower,
  getClassRankingWarningIndexFor,
  getFlucTypeForClass,
  getFlucValueForClass,
  getRankValueForClass,
  getTopRankingRows,
  loadPagesWithLimit,
  mergeRankingRows,
  sortRowsForViewWithClass,
  totalLoadTasks,
} from "./js/ranking-data.js";
import { capitalize, escapeHtml, formatDate, normalize } from "./js/utils.js";

const fields = ["ranking", "character", "class", "server", "guild", "union"];
const state = {
  rankingType: "growth",
  rows: [],
  filters: Object.fromEntries(fields.map((field) => [field, ""])),
  regionCode: "0",
  currentPage: 1,
};
const regionCache = new Map();

const body = document.querySelector("#rankingBody");
const visibleCount = document.querySelector("#visibleCount");
const pageTitle = document.querySelector("#pageTitle");
const growthTypeBtn = document.querySelector("#growthTypeBtn");
const levelTypeBtn = document.querySelector("#levelTypeBtn");
const rankingScreen = document.querySelector("#rankingScreen");
const compareScreen = document.querySelector("#compareScreen");
const rankingViewBtn = document.querySelector("#rankingViewBtn");
const compareViewBtn = document.querySelector("#compareViewBtn");
const regionSelect = document.querySelector("#regionSelect");
const prevPage = document.querySelector("#prevPage");
const nextPage = document.querySelector("#nextPage");
const pageInfo = document.querySelector("#pageInfo");
const leftWinRate = document.querySelector("#leftWinRate");
const rightWinRate = document.querySelector("#rightWinRate");
const leftWinBar = document.querySelector("#leftWinBar");
const rightWinBar = document.querySelector("#rightWinBar");
const winRateSummary = document.querySelector("#winRateSummary");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingPercent = document.querySelector("#loadingPercent");
const loadingBarFill = document.querySelector("#loadingBarFill");
const loadingMessage = document.querySelector("#loadingMessage");
const filterInputs = Object.fromEntries(
  fields.map((field) => [field, document.querySelector(`#filter-${field}`)])
);
let activeLoadId = 0;
const activeCompareLoadIds = {
  left: 0,
  right: 0,
};
const compareState = {
  left: createCompareSideState(),
  right: createCompareSideState(),
};

function createCompareSideState() {
  return {
    regionCode: "0",
    rows: [],
    filters: {
      server: "",
      guild: "",
      union: "",
    },
  };
}

function flucLabel(row) {
  return flucLabelForClass(row, state.filters.class);
}

function flucLabelForClass(row, classFilter) {
  const type = getFlucTypeForClass(row, classFilter);
  const value = getFlucValueForClass(row, classFilter);
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

function bindFilters() {
  growthTypeBtn.addEventListener("click", () => switchRankingType("growth"));
  levelTypeBtn.addEventListener("click", () => switchRankingType("level"));
  rankingViewBtn.addEventListener("click", () => switchView("ranking"));
  compareViewBtn.addEventListener("click", () => switchView("compare"));

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

  bindCompareFilters();
}

function bindCompareFilters() {
  for (const panel of document.querySelectorAll(".compare-panel")) {
    const side = panel.dataset.side;
    for (const control of panel.querySelectorAll("[data-compare-field]")) {
      const field = control.dataset.compareField;
      const eventName = control.tagName === "SELECT" ? "change" : "input";

      control.addEventListener(eventName, () => {
        if (field === "regionCode") {
          compareState[side].regionCode = control.value;
          loadCompareSide(side);
          return;
        }

        compareState[side].filters[field] = normalize(control.value);
        renderCompareSide(side);
      });
    }
  }
}

function switchView(view) {
  const isCompare = view === "compare";
  rankingScreen.hidden = isCompare;
  compareScreen.hidden = !isCompare;
  rankingViewBtn.classList.toggle("active", !isCompare);
  compareViewBtn.classList.toggle("active", isCompare);

  if (isCompare) {
    loadCompareSide("left");
    loadCompareSide("right");
  }
}

function switchRankingType(rankingType) {
  if (state.rankingType === rankingType) return;

  state.rankingType = rankingType;
  state.currentPage = 1;
  pageTitle.textContent = rankingTypes[rankingType];
  growthTypeBtn.classList.toggle("active", rankingType === "growth");
  levelTypeBtn.classList.toggle("active", rankingType === "level");

  if (compareScreen.hidden) {
    loadData();
  } else {
    loadCompareSide("left");
    loadCompareSide("right");
  }
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
  const cachedRows = regionCache.get(getCacheKey(state.rankingType, state.regionCode));

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
    const rows = await loadPagesWithLimit(state.rankingType, state.regionCode, (loadedPages, loadedRows) => {
      if (loadId !== activeLoadId) return;
      setLoading(
        (loadedPages / totalLoadTasks()) * 100,
        `Loaded ${loadedPages} of ${totalLoadTasks()} requests (${loadedRows.toLocaleString()} rows)...`
      );
    });

    if (loadId !== activeLoadId) return;
    const mergedRows = mergeRankingRows(rows);
    regionCache.set(getCacheKey(state.rankingType, state.regionCode), mergedRows);
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

async function loadCompareSide(side) {
  const loadId = (activeCompareLoadIds[side] += 1);
  const sideState = compareState[side];
  const cachedRows = regionCache.get(getCacheKey(state.rankingType, sideState.regionCode));

  if (cachedRows) {
    sideState.rows = cachedRows;
    renderCompareSide(side);
    return;
  }

  renderCompareLoading(side);
  setLoading(0, `Loading ${getCompareTitle(side)}...`);

  try {
    const rows = await loadPagesWithLimit(state.rankingType, sideState.regionCode, (loadedPages, loadedRows) => {
      if (loadId !== activeCompareLoadIds[side]) return;
      setLoading(
        (loadedPages / totalLoadTasks()) * 100,
        `${getCompareTitle(side)}: loaded ${loadedPages} of ${totalLoadTasks()} requests (${loadedRows.toLocaleString()} rows)...`
      );
    });

    if (loadId !== activeCompareLoadIds[side]) return;
    const mergedRows = mergeRankingRows(rows);
    regionCache.set(getCacheKey(state.rankingType, sideState.regionCode), mergedRows);
    sideState.rows = mergedRows;
    renderCompareSide(side);
    setLoading(100, "Done");
    window.setTimeout(() => {
      if (loadId === activeCompareLoadIds[side]) hideLoading();
    }, 250);
  } catch (error) {
    hideLoading();
    renderCompareError(side);
    console.error(error);
  }
}

function renderCompareSide(side) {
  const sideState = compareState[side];
  const bodyElement = document.querySelector(`#compare${capitalize(side)}Body`);
  const countElement = document.querySelector(`#compare${capitalize(side)}Count`);
  const metaElement = document.querySelector(`#compare${capitalize(side)}Meta`);
  const rows = sortRowsForViewWithClass(sideState.rows.filter((row) => matchesCompareFilters(row, sideState)), "");
  const warningIndex = getClassRankingWarningIndexFor(rows, "");
  const pageRows = rows.slice(0, compareRowsPerTable);

  countElement.textContent = `${rows.length.toLocaleString()} rows`;
  metaElement.textContent =
    rows.length > compareRowsPerTable
      ? `Showing first ${compareRowsPerTable.toLocaleString()} rows. Win rate uses ${getTopRankingRows(rows).length.toLocaleString()} official top 1,000 rows.`
      : `Win rate uses ${getTopRankingRows(rows).length.toLocaleString()} official top 1,000 rows.`;

  if (!pageRows.length) {
    bodyElement.innerHTML = '<tr><td colspan="4" class="empty">No matching data</td></tr>';
    renderWinRate();
    return;
  }

  bodyElement.innerHTML = pageRows
    .map((row, index) => {
      const warningRow =
        index === warningIndex
          ? `
            <tr class="ranking-warning">
              <td colspan="4">
                From No. ${(warningIndex + 1).toLocaleString()} onward, rows use normalized class ranking.
              </td>
            </tr>
          `
          : "";

      return `
        ${warningRow}
        <tr>
          <td>${(index + 1).toLocaleString()}</td>
          <td>
            <div class="rank-area">
              <div class="rank" data-rank="${getRankValueForClass(row, "")}">
                <div class="value">${getRankValueForClass(row, "")}</div>
              </div>
              <div class="fluc ${getFlucTypeForClass(row, "")}">${flucLabelForClass(row, "")}</div>
            </div>
          </td>
          <td>${escapeHtml(row.character)}</td>
          <td>${escapeHtml(row.class)}</td>
        </tr>
      `;
    })
    .join("");
  renderWinRate();
}

function matchesCompareFilters(row, sideState) {
  return ["server", "guild", "union"].every((field) => {
    const query = sideState.filters[field];
    return !query || normalize(row[field]).includes(query);
  });
}

function renderCompareLoading(side) {
  document.querySelector(`#compare${capitalize(side)}Count`).textContent = "Loading...";
  document.querySelector(`#compare${capitalize(side)}Meta`).textContent = "";
  document.querySelector(`#compare${capitalize(side)}Body`).innerHTML =
    '<tr><td colspan="4" class="empty">Loading ranking data...</td></tr>';
}

function renderCompareError(side) {
  document.querySelector(`#compare${capitalize(side)}Count`).textContent = "0 rows";
  document.querySelector(`#compare${capitalize(side)}Meta`).textContent = "";
  document.querySelector(`#compare${capitalize(side)}Body`).innerHTML =
    '<tr><td colspan="4" class="empty">Could not load data.</td></tr>';
}

function getCompareTitle(side) {
  return side === "left" ? "TEAM A" : "TEAM B";
}

function renderWinRate() {
  const leftRows = getCompareRowsForWinRate("left");
  const rightRows = getCompareRowsForWinRate("right");
  const leftPower = calculateTopRankingPower(leftRows);
  const rightPower = calculateTopRankingPower(rightRows);
  const totalPower = leftPower + rightPower;
  const leftRate = totalPower ? (leftPower / totalPower) * 100 : 50;
  const rightRate = totalPower ? 100 - leftRate : 50;

  leftWinRate.textContent = `${Math.round(leftRate)}%`;
  rightWinRate.textContent = `${Math.round(rightRate)}%`;
  leftWinBar.style.width = `${leftRate}%`;
  rightWinBar.style.width = `${rightRate}%`;
  winRateSummary.textContent = `Calculated from official top 1,000 rows only: TEAM A ${leftRows.length.toLocaleString()} rows, TEAM B ${rightRows.length.toLocaleString()} rows.`;
}

function getCompareRowsForWinRate(side) {
  const sideState = compareState[side];
  return getTopRankingRows(sideState.rows.filter((row) => matchesCompareFilters(row, sideState)));
}

function getCacheKey(rankingType, regionCode) {
  return `${rankingType}:${regionCode}`;
}

function sortRowsForView(rows) {
  return sortRowsForViewWithClass(rows, state.filters.class);
}

function getClassRankingWarningIndex(rows) {
  return getClassRankingWarningIndexFor(rows, state.filters.class);
}

function getRankValue(row) {
  return getRankValueForClass(row, state.filters.class);
}

function getFlucType(row) {
  return getFlucTypeForClass(row, state.filters.class);
}

function getFlucValue(row) {
  return getFlucValueForClass(row, state.filters.class);
}

bindFilters();
loadData();
