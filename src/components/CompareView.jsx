import { useMemo, useState } from "react";
import { compareRowsPerTable, regions, servers } from "../lib/config.js";
import { normalize } from "../lib/utils.js";
import {
  calculateTopRankingPower,
  getClassRankingWarningIndex,
  getFlucType,
  getFlucValue,
  getRankValue,
  getTopRankingRows,
  sortRowsForView,
} from "../lib/ranking.js";
import { useRankingData } from "../hooks/useRankingData.js";
import RankBadge from "./RankBadge.jsx";
import MultiSearchSelect from "./MultiSearchSelect.jsx";

const emptyFilters = { servers: [], guild: "", union: "" };

const inputClass =
  "w-full rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-gold-500 focus:outline-none";

export default function CompareView({ rankingType }) {
  const [leftRegion, setLeftRegion] = useState("0");
  const [rightRegion, setRightRegion] = useState("0");
  const [leftFilters, setLeftFilters] = useState(emptyFilters);
  const [rightFilters, setRightFilters] = useState(emptyFilters);

  const left = useRankingData(rankingType, leftRegion);
  const right = useRankingData(rankingType, rightRegion);

  const leftRows = useCompareRows(left.rows, leftFilters);
  const rightRows = useCompareRows(right.rows, rightFilters);

  const leftPower = calculateTopRankingPower(getTopRankingRows(leftRows));
  const rightPower = calculateTopRankingPower(getTopRankingRows(rightRows));
  const totalPower = leftPower + rightPower;
  const leftRate = totalPower ? (leftPower / totalPower) * 100 : 50;
  const rightRate = 100 - leftRate;

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Win rate comparison"
        className="rounded-2xl border border-night-700 bg-night-800/60 p-4 sm:p-6"
      >
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Team A</p>
            <p className="font-display text-3xl font-bold text-white tabular-nums">{Math.round(leftRate)}%</p>
          </div>
          <p className="pb-1 text-xs font-semibold uppercase tracking-widest text-zinc-600">Win Rate</p>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Team B</p>
            <p className="font-display text-3xl font-bold text-white tabular-nums">{Math.round(rightRate)}%</p>
          </div>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-night-700" aria-hidden="true">
          <div className="bg-gradient-to-r from-sky-500 to-sky-400 transition-all duration-500" style={{ width: `${leftRate}%` }} />
          <div className="bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-500" style={{ width: `${rightRate}%` }} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Calculated from official top 1,000 rows only with 10-rank brackets: 1-10 = 100 pts, 11-20 = 99 pts, ... 991-1000 = 1 pt.
          Team A {getTopRankingRows(leftRows).length.toLocaleString()} scored rows, Team B {getTopRankingRows(rightRows).length.toLocaleString()} scored rows.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ComparePanel
          title="Team A"
          accent="text-sky-400"
          regionCode={leftRegion}
          onRegionChange={setLeftRegion}
          filters={leftFilters}
          onFiltersChange={setLeftFilters}
          rows={leftRows}
          status={left.status}
          partial={left.partial}
        />
        <ComparePanel
          title="Team B"
          accent="text-rose-400"
          regionCode={rightRegion}
          onRegionChange={setRightRegion}
          filters={rightFilters}
          onFiltersChange={setRightFilters}
          rows={rightRows}
          status={right.status}
          partial={right.partial}
        />
      </div>
    </div>
  );
}

function useCompareRows(rows, filters) {
  return useMemo(() => {
    const serverSet = filters.servers.length ? new Set(filters.servers) : null;
    const guild = normalize(filters.guild);
    const union = normalize(filters.union);

    const matched = rows.filter((row) => {
      if (serverSet && !serverSet.has(row.server)) return false;
      if (guild && !normalize(row.guild).includes(guild)) return false;
      if (union && !normalize(row.union).includes(union)) return false;
      return true;
    });
    return sortRowsForView(matched, "");
  }, [rows, filters]);
}

function ComparePanel({ title, accent, regionCode, onRegionChange, filters, onFiltersChange, rows, status, partial }) {
  const warningIndex = getClassRankingWarningIndex(rows, "");
  const visibleRows = rows.slice(0, compareRowsPerTable);
  const scoredCount = getTopRankingRows(rows).length;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-night-700 bg-night-800/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className={`font-display text-lg font-bold uppercase tracking-wider ${accent}`}>{title}</h2>
        <span className="text-sm text-zinc-400">
          {status === "loading" ? "Loading..." : `${rows.length.toLocaleString()} rows`}
          {partial && <span className="ml-2 text-xs text-gold-400">(loading classes...)</span>}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select value={regionCode} onChange={(event) => onRegionChange(event.target.value)} className={inputClass}>
            {regions.map((region) => (
              <option key={region.code} value={region.code}>{region.name}</option>
            ))}
          </select>
          {["guild", "union"].map((field) => (
            <input
              key={field}
              type="search"
              autoComplete="off"
              placeholder={`Search ${field}`}
              value={filters[field]}
              onChange={(event) => onFiltersChange({ ...filters, [field]: event.target.value })}
              className={inputClass}
            />
          ))}
        </div>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <MultiSearchSelect
              selected={filters.servers}
              onChange={(values) => onFiltersChange({ ...filters, servers: values })}
              options={servers}
              placeholder="Add servers (multiple)"
            />
          </div>
          {filters.servers.length > 0 && (
            <button
              type="button"
              onClick={() => onFiltersChange({ ...filters, servers: [] })}
              className="shrink-0 rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-rose-500/50 hover:text-rose-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-night-700">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-night-800">
            <tr className="border-b border-night-600 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2">No.</th>
              <th className="px-3 py-2">Ranking</th>
              <th className="px-3 py-2">Character</th>
              <th className="px-3 py-2">Class</th>
            </tr>
          </thead>
          <tbody>
            {status === "error" ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-zinc-500">Could not load data.</td></tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                  {status === "loading" ? "Loading ranking data..." : "No matching data"}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <RowGroup key={`${row.regionCode}|${row.server}|${row.character}|${row.classCode}`} row={row} index={index} showWarning={index === warningIndex} warningIndex={warningIndex} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        {rows.length > compareRowsPerTable
          ? `Showing first ${compareRowsPerTable.toLocaleString()} rows. `
          : ""}
        Win rate scores {scoredCount.toLocaleString()} official top 1,000 rows.
      </p>
    </section>
  );
}

function RowGroup({ row, index, showWarning, warningIndex }) {
  return (
    <>
      {showWarning && (
        <tr>
          <td colSpan={4} className="bg-gold-500/5 px-3 py-2 text-xs text-gold-300/90">
            From No. {(warningIndex + 1).toLocaleString()} onward, rows use normalized class ranking.
          </td>
        </tr>
      )}
      <tr className="border-b border-night-700/60 last:border-0 hover:bg-night-700/30">
        <td className="px-3 py-2 tabular-nums text-zinc-500">{(index + 1).toLocaleString()}</td>
        <td className="px-3 py-2">
          <RankBadge rank={getRankValue(row, "")} flucType={getFlucType(row, "")} flucValue={getFlucValue(row, "")} />
        </td>
        <td className="px-3 py-2 font-medium text-white">{row.character}</td>
        <td className="px-3 py-2 text-gold-400/80">{row.class}</td>
      </tr>
    </>
  );
}
