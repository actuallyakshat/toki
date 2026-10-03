"use client";

import { LayoutGrid, ListOrdered, Pencil, Plus, Search, Share2 } from "lucide-react";
import { useMemo } from "react";
import { DigitSwap } from "@/components/motion/digit-swap";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { TokiButton } from "@/components/shared/buttons";
import { ListIcon } from "@/components/shared/list-icon";
import { GridSizeToggle } from "@/components/shared/grid-size-toggle";
import { ModeToggle } from "@/components/shared/mode-toggle";
import { formatMoney, formatTotalHours } from "@/lib/format";
import { useItems } from "@/lib/hooks/use-wishlist";
import { useApp } from "./app-context";
import type { ViewKind } from "./wishlist-view";

function useTotals() {
  const { list } = useApp();
  const items = useItems(list?.id);
  return useMemo(() => {
    if (items.data) {
      return {
        count: items.data.length,
        total: items.data.reduce((sum, i) => sum + i.product.current_price_minor, 0),
      };
    }
    return { count: list?.item_count ?? 0, total: list?.total_minor ?? 0 };
  }, [items.data, list]);
}

export function WishlistHeader({ view, onViewChange }: { view: ViewKind; onViewChange: (v: ViewKind) => void }) {
  const { list, mode, income, currency, requestMode, openModal, setPaletteOpen } = useApp();
  const { count, total } = useTotals();
  const text = mode === "time" && income ? formatTotalHours(total, income) : formatMoney(total, currency);

  return (
    <header className="px-4 pb-4 pt-5 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] leading-tight sm:text-[32px]">
            {list ? (
              <>
                <ListIcon value={list.emoji} className="mr-2.5 inline size-[0.8em] -translate-y-[0.05em] text-text-muted" />
                {list.name}
              </>
            ) : (
              <span className="inline-block h-9 w-48 animate-pulse rounded-lg bg-surface-sunk align-middle" />
            )}
          </h1>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[15px] text-text-muted">
            <DigitSwap value={text} animationKey={mode} fit duration={0.28} stagger={0.018} className="figure font-semibold text-text" />
            <span>
              across {count} {count === 1 ? "thing" : "things"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModeToggle mode={mode} onChange={requestMode} />
          <TokiButton variant="secondary" size="md" onClick={() => setPaletteOpen(true)} aria-label="Open the command menu">
            <Search className="size-4" aria-hidden />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded-md bg-surface-sunk px-1.5 py-0.5 text-[12px] text-text-muted sm:inline">⌘K</kbd>
          </TokiButton>
          <TokiButton onClick={() => openModal("add")}>
            <Plus className="size-4" aria-hidden />
            Add
          </TokiButton>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <Tabs variant="segment" value={view} onValueChange={(v) => onViewChange(v as ViewKind)}>
          <TabsList className="rounded-[var(--radius-control)] border border-border p-1 [&_[role=tab]]:rounded-[4px]" wrapperClassName="w-auto">
            <TabsTrigger value="grid" className="gap-1.5 px-3" indicatorClassName="rounded-[4px]">
              <LayoutGrid className="size-4" aria-hidden />
              Grid
            </TabsTrigger>
            <TabsTrigger value="priority" className="gap-1.5 px-3" indicatorClassName="rounded-[4px]">
              <ListOrdered className="size-4" aria-hidden />
              Priority
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {view === "grid" && <GridSizeToggle />}
          <TokiButton variant="ghost" size="sm" onClick={() => openModal("edit-list")} disabled={!list}>
            <Pencil className="size-4" aria-hidden />
            Edit list
          </TokiButton>
          <TokiButton variant="ghost" size="sm" onClick={() => openModal("share")} disabled={!list}>
          <Share2 className="size-4" aria-hidden />
          Share
          </TokiButton>
        </div>
      </div>
    </header>
  );
}
