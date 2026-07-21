import { useEffect, useMemo, useRef, useState } from "react";
import { normalize } from "../lib/utils.js";

function buildGroups(options) {
  const groups = new Map();
  for (const option of options) {
    const base = option.split("/")[0];
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(option);
  }
  return Array.from(groups, ([base, children]) => ({ base, children }));
}

function Checkbox({ checked, indeterminate, onChange, label, sub }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);

  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-night-700/50 ${
        sub ? "pl-7 text-sm text-zinc-300" : "text-sm font-semibold text-zinc-100"
      }`}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 shrink-0 accent-[var(--color-gold-500)]"
      />
      <span className="truncate">{label}</span>
    </label>
  );
}

export default function ServerCheckboxSelect({ selected, onChange, options, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const groups = useMemo(() => buildGroups(options), [options]);

  const visibleGroups = useMemo(() => {
    const q = normalize(query);
    if (!q) return groups;
    return groups
      .map((group) => {
        if (normalize(group.base).includes(q)) return group;
        const children = group.children.filter((child) => normalize(child).includes(q));
        return children.length ? { ...group, children } : null;
      })
      .filter(Boolean);
  }, [groups, query]);

  useEffect(() => {
    function onPointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function toggleChild(child, checked) {
    if (checked) onChange([...selected, child]);
    else onChange(selected.filter((item) => item !== child));
  }

  function toggleGroup(group, checked) {
    const childSet = new Set(group.children);
    const withoutGroup = selected.filter((item) => !childSet.has(item));
    onChange(checked ? [...withoutGroup, ...group.children] : withoutGroup);
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setOpen((value) => !value)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        className="flex min-h-[2.5rem] w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-night-600 bg-night-900 px-2 py-1.5 text-left text-sm transition-colors focus-within:border-gold-500 focus:border-gold-500 focus:outline-none"
      >
        {selected.length === 0 ? (
          <span className="px-1 text-zinc-600">{placeholder}</span>
        ) : (
          <div className="flex flex-1 flex-wrap items-center gap-1">
            {selected.map((server) => (
              <span
                key={server}
                className="inline-flex items-center gap-1 rounded-md bg-gold-500/15 px-2 py-0.5 text-xs font-medium text-gold-300"
              >
                {server}
                <button
                  type="button"
                  aria-label={`Remove ${server}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(selected.filter((item) => item !== server));
                  }}
                  className="text-gold-300/70 transition-colors hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <span className="shrink-0 pr-1 text-zinc-500">{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[16rem] rounded-lg border border-night-600 bg-night-900 shadow-xl shadow-black/40">
          <div className="border-b border-night-700 p-2">
            <input
              type="search"
              autoComplete="off"
              autoFocus
              placeholder="Search servers"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-md border border-night-600 bg-night-950 px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-gold-500 focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {visibleGroups.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-zinc-600">No servers</p>
            ) : (
              visibleGroups.map((group) => {
                const selectedCount = group.children.reduce(
                  (count, child) => count + (selectedSet.has(child) ? 1 : 0),
                  0
                );
                const allSelected = selectedCount === group.children.length;
                return (
                  <div key={group.base} className="mb-1">
                    <Checkbox
                      label={group.base}
                      checked={allSelected}
                      indeterminate={selectedCount > 0}
                      onChange={(checked) => toggleGroup(group, checked)}
                    />
                    {group.children.map((child) => (
                      <Checkbox
                        key={child}
                        sub
                        label={child.split("/")[1] || child}
                        checked={selectedSet.has(child)}
                        onChange={(checked) => toggleChild(child, checked)}
                      />
                    ))}
                  </div>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="flex items-center justify-between border-t border-night-700 px-3 py-2 text-xs">
              <span className="text-zinc-500">{selected.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="font-medium text-zinc-400 transition-colors hover:text-rose-300"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
