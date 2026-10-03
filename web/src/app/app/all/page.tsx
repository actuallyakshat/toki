"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/app-context";
import { UNIFORM_IMAGE, toCardData } from "@/components/app/item-card";
import { GridSizeToggle } from "@/components/shared/grid-size-toggle";
import { ListIcon } from "@/components/shared/list-icon";
import { ModeToggle } from "@/components/shared/mode-toggle";
import { ProductCard } from "@/components/shared/product-card";
import { api } from "@/lib/api";
import { formatMoney, formatTotalHours } from "@/lib/format";
import { GRID_CLASS, useGridSize } from "@/lib/grid-size";
import { itemsKey } from "@/lib/hooks/use-wishlist";
import { cn } from "@/lib/utils";

/** Every wanted item from every list in one grid, filterable by list. */
export default function AllItemsPage() {
  const { lists, mode, income, currency, requestMode, setListId, openItem } = useApp();
  const [filter, setFilter] = useState<string>("all");
  const size = useGridSize();
  const results = useQueries({
    queries: lists.map((l) => ({
      queryKey: itemsKey(l.id),
      queryFn: async () => (await api.items(l.id)).items,
    })),
  });
  const loading = results.some((r) => r.isLoading);
  const all = useMemo(() => results.flatMap((r) => r.data ?? []), [results]);
  const byId = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  const items = filter === "all" ? all : all.filter((i) => i.list_id === filter);
  const total = items.reduce((sum, i) => sum + i.product.current_price_minor, 0);
  const totalText = mode === "time" && income ? formatTotalHours(total, income) : formatMoney(total, currency);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-tight sm:text-[32px]">All items</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            <span className="figure tnum text-text">{totalText}</span> across {items.length} {items.length === 1 ? "thing" : "things"}
            {filter === "all" ? ` in ${lists.length} ${lists.length === 1 ? "list" : "lists"}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GridSizeToggle />
          <ModeToggle mode={mode} onChange={requestMode} />
        </div>
      </div>

      <div role="group" aria-label="Filter by list" className="mt-6 flex flex-wrap gap-2 border-b border-border pb-4">
        {[{ id: "all", emoji: "", name: "All lists", count: all.length }, ...lists.map((l) => ({ id: l.id, emoji: l.emoji, name: l.name, count: l.item_count }))].map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors duration-[var(--dur-base)]",
              filter === f.id ? "border-transparent bg-accent text-accent-contrast" : "border-border text-text-muted hover:bg-surface-sunk hover:text-text",
            )}
          >
            {f.id !== "all" && <ListIcon value={f.emoji} className="size-3.5" />}
            {f.name}
            <span className={cn("tnum text-[12px]", filter === f.id ? "opacity-70" : "text-text-faint")}>{f.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div aria-hidden className={`mt-6 ${GRID_CLASS[size]}`}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-card bg-surface-sunk" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 flex items-center justify-center rounded-card border border-dashed border-border px-6 py-16 text-center">
          <p className="max-w-md text-[13px] leading-relaxed text-text-muted">
            Nothing to show. Add a product from any store, or paste a link with Add.
          </p>
        </div>
      ) : (
        <ul aria-label="All items" className={`mt-6 ${GRID_CLASS[size]}`}>
          {items.map((item, index) => {
            const list = byId.get(item.list_id);
            return (
              <li key={item.id}>
                <ProductCard
                  data={toCardData(item)}
                  mode={mode}
                  income={income}
                  index={index}
                  className="h-full"
                  imageClassName={UNIFORM_IMAGE}
                  onOpen={() => {
                    // The detail view reads the current list, so open the item from its own list.
                    setListId(item.list_id);
                    openItem(item.id);
                  }}
                  footer={
                    list ? (
                      <p className="flex items-center gap-1.5 text-[12px] text-text-muted">
                        <ListIcon value={list.emoji} className="size-3.5" />
                        {list.name}
                      </p>
                    ) : null
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
