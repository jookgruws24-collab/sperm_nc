import { useEffect, useMemo, useRef, useState } from "react";
import { normalize } from "../lib/utils.js";

export default function SearchSelect({ value, onChange, options, placeholder, className }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const query = normalize(value);
    if (!query) return options;
    return options.filter((option) => normalize(option).includes(query));
  }, [options, value]);

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
    const item = listRef.current?.children[highlighted];
    item?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  function select(option) {
    onChange(option);
    setOpen(false);
  }

  function onKeyDown(event) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      setHighlighted(0);
      event.preventDefault();
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      setHighlighted((index) => Math.min(index + 1, filtered.length - 1));
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      setHighlighted((index) => Math.max(index - 1, 0));
      event.preventDefault();
    } else if (event.key === "Enter") {
      if (filtered[highlighted]) select(filtered[highlighted]);
      event.preventDefault();
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={className}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="absolute inset-y-0 right-2 text-zinc-500 transition-colors hover:text-zinc-200"
        >
          ×
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-night-600 bg-night-900 py-1 shadow-xl shadow-black/40"
        >
          {filtered.map((option, index) => (
            <li
              key={option}
              role="option"
              aria-selected={option === value}
              onPointerDown={(event) => {
                event.preventDefault();
                select(option);
              }}
              onMouseEnter={() => setHighlighted(index)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                index === highlighted ? "bg-gold-500/15 text-gold-300" : "text-zinc-300"
              } ${option === value ? "font-semibold" : ""}`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
