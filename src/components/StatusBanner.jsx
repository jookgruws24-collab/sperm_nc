export default function StatusBanner({ status, partial }) {
  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-night-600 bg-night-900 px-4 py-3 text-sm text-zinc-300">
        <span className="size-4 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
        Loading global top 1,000...
      </div>
    );
  }

  if (partial) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gold-500/30 bg-gold-500/5 px-4 py-3 text-sm text-gold-300">
        <span className="size-4 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
        Global top 1,000 loaded — fetching class rankings in the background...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
        Could not load ranking data from Night Crows. Please try again.
      </div>
    );
  }

  return null;
}
