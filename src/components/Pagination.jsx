import { pageSizeOptions } from "../lib/config.js";

export default function Pagination({ page, pageCount, pageSize, onPageChange, onPageSizeChange }) {
  const btn =
    "rounded-lg border border-night-600 bg-night-900 px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:border-gold-500/50 hover:text-gold-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-night-600 disabled:hover:text-zinc-300";

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Table pagination">
      <label className="flex items-center gap-2 text-sm text-zinc-400">
        <span>Rows</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-lg border border-night-600 bg-night-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-gold-500 focus:outline-none"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(1)}>«</button>
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
        <span className="px-2 text-sm tabular-nums text-zinc-400">
          {page.toLocaleString()} / {pageCount.toLocaleString()}
        </span>
        <button type="button" className={btn} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Next</button>
        <button type="button" className={btn} disabled={page >= pageCount} onClick={() => onPageChange(pageCount)}>»</button>
      </div>
    </nav>
  );
}
