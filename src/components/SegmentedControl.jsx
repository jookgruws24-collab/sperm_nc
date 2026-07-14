export default function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="flex rounded-xl border border-night-600 bg-night-900 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
            value === option.value
              ? "bg-gold-500/15 text-gold-300 shadow-[inset_0_0_0_1px_rgba(245,196,81,0.35)]"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
