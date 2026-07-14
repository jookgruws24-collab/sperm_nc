import { useDeferredValue, useMemo, useState } from "react";
import { defaultPageSize, regions, weaponTypes } from "../lib/config.js";
import { normalize, formatDate } from "../lib/utils.js";
import {
  getClassRankingWarningIndex,
  getFlucType,
  getFlucValue,
  getRankValue,
  sortRowsForView,
} from "../lib/ranking.js";
import { useRankingData } from "../hooks/useRankingData.js";
import RankBadge from "./RankBadge.jsx";
import Pagination from "./Pagination.jsx";
import StatusBanner from "./StatusBanner.jsx";

const searchFields = [
  { field: "ranking", label: "Ranking" },
  { field: "character", label: "Character" },
  { field: "server", label: "Server" },
  { field: "guild", label: "Guild" },
  { field: "union", label: "Union" },
];

const emptyFilters = { ranking: "", character: "", class: "", server: "", guild: "", union: "" };

const inputClass =
  "w-full rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-gold-500 focus:outline-none";

export default function RankingView({ rankingType }) {
  const [regionCode, setRegionCode] = useState("0");
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const { rows, status, partial } = useRankingData(rankingType, regionCode);
  const deferredFilters = useDeferredValue(filters);

  const filteredRows = useMemo(() => {
    const active = Object.entries(deferredFilters)
      .map(([field, value]) => [field, field === "class" ? value : normalize(value)])
      .filter(([, value]) => value);
    const matched = active.length
      ? rows.filter((row) =>
          active.every(([field, query]) =>
            field === "class" ? row.class === query : normalize(row[field]).includes(query)
          )
        )
      : rows;
    return sortRowsForView(matched, deferredFilters.class);
  }, [rows, deferredFilters]);

  const warningIndex = useMemo(
    () => getClassRankingWarningIndex(filteredRows, deferredFilters.class),
    [filteredRows, deferredFilters.class]
  );

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = filteredRows.slice(start, start + pageSize);
  const classFilter = deferredFilters.class;

  function setFilter(field, value) {
    setFilters((previous) => ({ ...previous, [field]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setRegionCode("0");
    setPage(1);
  }

  const hasActiveFilters = regionCode !== "0" || Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <StatusBanner status={status} partial={partial} />

      <section
        aria-label="Table filters"
        className="grid grid-cols-2 gap-3 rounded-2xl border border-night-700 bg-night-800/60 p-4 backdrop-blur sm:grid-cols-3 lg:grid-cols-8"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Region</span>
          <select
            value={regionCode}
            onChange={(event) => { setRegionCode(event.target.value); setPage(1); }}
            className={inputClass}
          >
            {regions.map((region) => (
              <option key={region.code} value={region.code}>{region.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Class</span>
          <select
            value={filters.class}
            onChange={(event) => setFilter("class", event.target.value)}
            className={inputClass}
          >
            <option value="">All Classes</option>
            {weaponTypes.map((weaponType) => (
              <option key={weaponType.code} value={weaponType.name}>{weaponType.name}</option>
            ))}
          </select>
        </label>
        {searchFields.map(({ field, label }) => (
          <label key={field} className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
            <input
              type="search"
              autoComplete="off"
              placeholder={`Search ${label.toLocaleLowerCase()}`}
              value={filters[field]}
              onChange={(event) => setFilter(field, event.target.value)}
              className={inputClass}
            />
          </label>
        ))}
        <div className="flex items-end">
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="w-full rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-rose-500/50 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </section>

      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          <strong className="text-gold-300">{filteredRows.length.toLocaleString()}</strong> rows
        </span>
        <span className="hidden sm:inline">{classFilter ? "Class Ranking" : "Global + Class Ranking"}</span>
      </div>

      {/* Desktop table */}
      <section className="hidden overflow-hidden rounded-2xl border border-night-700 bg-night-800/60 md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-night-600 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">{classFilter ? "Class Ranking" : "Ranking"}</th>
                <th className="px-4 py-3">Character</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Server</th>
                <th className="px-4 py-3">Guild</th>
                <th className="px-4 py-3">Union</th>
                <th className="px-4 py-3">Max Rank Date</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    {status === "loading" ? "Loading ranking data..." : "No matching data"}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, index) => {
                  const absoluteIndex = start + index;
                  return (
                    <RowGroup
                      key={`${row.regionCode}|${row.server}|${row.character}|${row.classCode}`}
                      row={row}
                      absoluteIndex={absoluteIndex}
                      showWarning={absoluteIndex === warningIndex}
                      warningIndex={warningIndex}
                      classFilter={classFilter}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mobile cards */}
      <section className="flex flex-col gap-2 md:hidden">
        {pageRows.length === 0 ? (
          <p className="rounded-2xl border border-night-700 bg-night-800/60 px-4 py-10 text-center text-sm text-zinc-500">
            {status === "loading" ? "Loading ranking data..." : "No matching data"}
          </p>
        ) : (
          pageRows.map((row, index) => {
            const absoluteIndex = start + index;
            return (
              <div key={`${row.regionCode}|${row.server}|${row.character}|${row.classCode}`}>
                {absoluteIndex === warningIndex && <WarningNote warningIndex={warningIndex} />}
                <article className="rounded-2xl border border-night-700 bg-night-800/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">{row.character}</p>
                      <p className="text-xs text-gold-400/80">{row.class}</p>
                    </div>
                    <RankBadge
                      rank={getRankValue(row, classFilter)}
                      flucType={getFlucType(row, classFilter)}
                      flucValue={getFlucValue(row, classFilter)}
                    />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400">
                    <div className="flex justify-between gap-2"><dt className="text-zinc-600">No.</dt><dd>{(absoluteIndex + 1).toLocaleString()}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-zinc-600">Server</dt><dd className="truncate">{row.server}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-zinc-600">Guild</dt><dd className="truncate">{row.guild || "-"}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-zinc-600">Union</dt><dd className="truncate">{row.union || "-"}</dd></div>
                    <div className="col-span-2 flex justify-between gap-2"><dt className="text-zinc-600">Max Rank</dt><dd>{formatDate(row.maxRankDate) || "-"}</dd></div>
                  </dl>
                </article>
              </div>
            );
          })
        )}
      </section>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </div>
  );
}

function RowGroup({ row, absoluteIndex, showWarning, warningIndex, classFilter }) {
  return (
    <>
      {showWarning && (
        <tr>
          <td colSpan={8} className="bg-gold-500/5 px-4 py-2 text-xs text-gold-300/90">
            From No. {(warningIndex + 1).toLocaleString()} onward, rows use normalized class ranking
            because the official global ranking is only available for the top 1,000.
          </td>
        </tr>
      )}
      <tr className="border-b border-night-700/60 transition-colors last:border-0 hover:bg-night-700/30">
        <td className="px-4 py-2.5 tabular-nums text-zinc-500">{(absoluteIndex + 1).toLocaleString()}</td>
        <td className="px-4 py-2.5">
          <RankBadge
            rank={getRankValue(row, classFilter)}
            flucType={getFlucType(row, classFilter)}
            flucValue={getFlucValue(row, classFilter)}
          />
        </td>
        <td className="px-4 py-2.5 font-medium text-white">{row.character}</td>
        <td className="px-4 py-2.5 text-gold-400/80">{row.class}</td>
        <td className="px-4 py-2.5 text-zinc-400">{row.server}</td>
        <td className="px-4 py-2.5 text-zinc-400">{row.guild}</td>
        <td className="px-4 py-2.5 text-zinc-400">{row.union}</td>
        <td className="px-4 py-2.5 text-zinc-500">{formatDate(row.maxRankDate)}</td>
      </tr>
    </>
  );
}

function WarningNote({ warningIndex }) {
  return (
    <p className="mb-2 rounded-xl border border-gold-500/20 bg-gold-500/5 px-4 py-2 text-xs text-gold-300/90">
      From No. {(warningIndex + 1).toLocaleString()} onward, rows use normalized class ranking.
    </p>
  );
}
