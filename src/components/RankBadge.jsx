export default function RankBadge({ rank, flucType, flucValue }) {
  const flucLabel =
    flucType === "up" ? `▲ ${flucValue}` : flucType === "down" ? `▼ ${flucValue}` : flucValue || "-";
  const flucClass =
    flucType === "up"
      ? "text-emerald-400"
      : flucType === "down"
        ? "text-rose-400"
        : flucType === "new"
          ? "text-sky-400"
          : "text-zinc-500";
  const top3 = rank >= 1 && rank <= 3;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex min-w-12 items-center justify-center rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${
          top3
            ? "bg-gold-500/20 text-gold-300 shadow-[inset_0_0_0_1px_rgba(245,196,81,0.4)]"
            : "bg-night-700 text-zinc-200"
        }`}
      >
        {Number(rank).toLocaleString()}
      </span>
      <span className={`text-xs font-semibold ${flucClass}`}>{flucLabel}</span>
    </div>
  );
}
