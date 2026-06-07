const fields = ["ranking", "character", "class", "server", "guild", "union"];
const state = {
  rows: [],
  filters: Object.fromEntries(fields.map((field) => [field, ""])),
  regionCode: "0",
};

const body = document.querySelector("#rankingBody");
const visibleCount = document.querySelector("#visibleCount");
const regionSelect = document.querySelector("#regionSelect");
const filterInputs = Object.fromEntries(
  fields.map((field) => [field, document.querySelector(`#filter-${field}`)])
);

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function flucLabel(row) {
  if (row.fluctuationType === "up") return `▲ ${row.fluctuation}`;
  if (row.fluctuationType === "down") return `▼ ${row.fluctuation}`;
  return row.fluctuation || "-";
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
  const rows = state.rows.filter(matchesFilters);
  visibleCount.textContent = rows.length.toLocaleString();

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No matching data</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>
            <div class="rank-area">
              <div class="rank" data-rank="${row.ranking}">
                <div class="value">${row.ranking}</div>
              </div>
              <div class="fluc ${row.fluctuationType}">${flucLabel(row)}</div>
            </div>
          </td>
          <td>${escapeHtml(row.character)}</td>
          <td>${escapeHtml(row.class)}</td>
          <td>${escapeHtml(row.server)}</td>
          <td>${escapeHtml(row.guild)}</td>
          <td>${escapeHtml(row.union)}</td>
          <td>${escapeHtml(formatDate(row.maxRankDate))}</td>
        </tr>
      `
    )
    .join("");
}

function renderClassOptions() {
  const classSelect = filterInputs.class;
  const current = state.filters.class;
  const classes = Array.from(new Set(state.rows.map((row) => row.class).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

  classSelect.innerHTML = [
    '<option value="">All Classes</option>',
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
      render();
    });
  }

  regionSelect.addEventListener("change", () => {
    state.regionCode = regionSelect.value;
    loadData();
  });
}

async function loadData() {
  body.innerHTML = '<tr><td colspan="7" class="empty">Loading ranking data...</td></tr>';
  visibleCount.textContent = "0";

  try {
    const response = await fetch(`/api/ranking?regionCode=${encodeURIComponent(state.regionCode)}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.rows = Array.isArray(data.items) ? data.items : [];
    renderClassOptions();
    render();
  } catch (error) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="empty">
          Could not load ranking data from Night Crows.
        </td>
      </tr>
    `;
    console.error(error);
  }
}

bindFilters();
loadData();
