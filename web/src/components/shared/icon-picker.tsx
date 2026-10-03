"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { DynamicIcon } from "lucide-react/dynamic";
import { useMemo, useRef, useState } from "react";
import { iconValue } from "@/lib/list-icon-value";
import { cn } from "@/lib/utils";
import { ALL_ICON_NAMES, ListIcon, iconLabel, resolveIconName } from "./list-icon";

const COLUMNS = 8;
const ROW_HEIGHT = 36;

/** The icon field: shows the chosen icon and opens the picker below the form row. */
export function IconTrigger({
  value,
  open,
  onToggle,
  label = "Icon",
}: {
  value: string;
  open: boolean;
  onToggle: () => void;
  label?: string;
}) {
  const name = resolveIconName(value);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-1 text-sm font-medium text-foreground">{label}</span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="icon-panel"
        aria-label={`Icon: ${name ? iconLabel(name) : value || "List"}. ${open ? "Close" : "Choose an icon"}`}
        onClick={onToggle}
        className={cn(
          "flex h-11 items-center justify-center rounded-[var(--radius-control)] border border-border text-text transition-colors duration-[var(--dur-base)] hover:bg-surface-sunk",
          open && "border-foreground/40 ring-2 ring-ring/40",
        )}
      >
        <ListIcon value={value} className="size-5" />
      </button>
    </div>
  );
}

/**
 * Every lucide icon in a searchable, virtualised grid. Only the rows on screen are drawn, and each
 * icon loads its own small chunk, so opening the picker stays cheap. Escape closes it before the modal.
 */
export function IconPanel({ value, onSelect, onClose }: { value: string; onSelect: (value: string) => void; onClose: () => void }) {
  // TanStack Virtual returns fresh functions each render; the React Compiler must not memoise around them.
  "use no memo";
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const selected = resolveIconName(value);

  const names = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "-");
    return q ? ALL_ICON_NAMES.filter((n) => n.includes(q)) : ALL_ICON_NAMES;
  }, [query]);
  const rows = Math.ceil(names.length / COLUMNS);

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 4,
  });

  return (
    <div
      id="icon-panel"
      className="flex flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center gap-2 p-1.5">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            scrollRef.current?.scrollTo({ top: 0 });
          }}
          placeholder="Search icons"
          aria-label="Search icons"
          className="h-9 min-w-0 flex-1 rounded-[6px] border border-border bg-transparent px-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-foreground/40 sm:text-[13px]"
        />
        <span className="shrink-0 pr-1 text-[12px] tabular-nums text-text-faint">{names.length}</span>
      </div>
      {names.length === 0 ? (
        <p className="px-3 py-6 text-center text-[13px] text-text-muted">No icons match that search.</p>
      ) : (
        <div ref={scrollRef} role="listbox" aria-label="Icons" className="h-[216px] overflow-y-auto px-1.5 pb-1.5">
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((row) => (
              <div
                key={row.key}
                className="absolute inset-x-0 grid grid-cols-8 gap-0.5"
                style={{ top: row.start, height: ROW_HEIGHT }}
              >
                {names.slice(row.index * COLUMNS, row.index * COLUMNS + COLUMNS).map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={selected === name}
                    aria-label={iconLabel(name)}
                    title={iconLabel(name)}
                    onClick={() => onSelect(iconValue(name))}
                    className={cn(
                      "flex items-center justify-center rounded-[4px] text-text-muted transition-colors duration-[var(--dur-fast)] hover:bg-surface-sunk hover:text-text",
                      selected === name && "bg-surface-sunk text-text",
                    )}
                  >
                    <DynamicIcon name={name} aria-hidden className="size-[18px]" fallback={() => <span className="size-[18px]" />} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
