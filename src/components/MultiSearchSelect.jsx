import { useEffect, useMemo, useRef, useState } from "react";
import { normalize } from "../lib/utils.js";

export default function MultiSearchSelect({ selected, onChange, options, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const available = useMemo(() => {
    const selectedSet = new Set(selected);
    const q = normalize(query);
    return options.filter(
      (option) => !selectedSet.has(option) && (!q || normalize(option).includes(q))
    );
  }, [options, selected, query]);

  useEffect(() => {
    function onPointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    listRef.current?.children[highlighted]?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  function add(option) {
    onChange([...selected, option]);
    setQuery("");
    setHighlighted(0);
  }

  function remove(option) {
    onChange(selected.filter((item) => item !== option));
  }

  function onKeyDown(event) {
    if (event.key === "Backspace" && !query && selected.length) {
      remove(selected[selected.length - 1]);
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      setHighlighted(0);
      event.preventDefault();
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      setHighlighted((index) => Math.min(index + 1, available.length - 1));
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      setHighlighted((index) => Math.max(index - 1, 0));
      event.preventDefault();
    } else if (event.key === "Enter") {
      if (available[highlighted]) add(available[highlighted]);
      event.preventDefault();
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="flex min-h-[2.5rem] flex-wrap items-center gap-1 rounded-lg border border-night-600 bg-night-900 px-2 py-1.5 focus-within:border-gold-500"
      >
        {selected.map((server) => (
          <span
            key={server}
            className="inline-flex items-center gap-1 rounded-md bg-gold-500/15 px-2 py-0.5 text-xs font-medium text-gold-300"
          >
            {server}
            <button
              type="button"
              aria-label={`Remove ${server}`}
              onPointerDown={(event) => {
                event.preventDefault();
                remove(server);
              }}
              className="text-gold-300/70 transition-colors hover:text-white"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          placeholder={selected.length ? "" : placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-[6rem] flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
        />
      </div>
      {open && available.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-night-600 bg-night-900 py-1 shadow-xl shadow-black/40"
        >
          {available.map((option, index) => (
            <li
              key={option}
              role="option"
              aria-selected={false}
              onPointerDown={(event) => {
                event.preventDefault();
                add(option);
              }}
              onMouseEnter={() => setHighlighted(index)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                index === highlighted ? "bg-gold-500/15 text-gold-300" : "text-zinc-300"
              }`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
