"use client";

import { useQueryClient } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  SortableList,
  SortableListGroup,
  SortableListHandle,
  SortableListItem,
  SortableListItemContent,
  SortableListUndo,
} from "@/components/motion/sortable-list";
import { DeltaChip } from "@/components/shared/delta-chip";
import { PriceFigure } from "@/components/shared/price-figure";
import { ProductImage } from "@/components/shared/product-image";
import { itemsKey, useItems, useReorder } from "@/lib/hooks/use-wishlist";
import type { Item } from "@/lib/types";
import { retailerName } from "@/lib/format";
import { GRID_CLASS, useGridSize } from "@/lib/grid-size";
import { useApp } from "./app-context";
import { EmptyState } from "./empty-state";
import { ItemCard } from "./item-card";

export type ViewKind = "grid" | "priority";

/** Columns of the priority table: rank, item, now, change, then lowest and target on wide screens. */
const ROW = "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_6.5rem] sm:gap-4 lg:grid-cols-[1.75rem_minmax(0,1fr)_7rem_7rem_7rem_7rem]";


function Skeleton() {
  const size = useGridSize();
  return (
    <div aria-hidden className={`${GRID_CLASS[size]} px-4 sm:px-8`}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="animate-pulse rounded-card bg-surface p-2.5 shadow-card">
          <div className="aspect-[4/3] rounded-image bg-surface-sunk" />
          <div className="mt-4 h-3 w-2/3 rounded-full bg-surface-sunk" />
          <div className="mt-3 h-4 w-1/3 rounded-full bg-surface-sunk" />
          <div className="mt-3 h-4 w-1/4 rounded-full bg-surface-sunk" />
        </div>
      ))}
    </div>
  );
}

export function WishlistView({ view }: { view: ViewKind }) {
  const { list, mode, income, openItem } = useApp();
  const items = useItems(list?.id);
  const size = useGridSize();

  if (!list || items.isLoading) return <Skeleton />;
  if (items.isError) {
    return (
      <div className="px-4 py-16 sm:px-8">
        <p className="text-[15px]">Toki could not load this list.</p>
        <button type="button" onClick={() => items.refetch()} className="mt-2 font-medium underline underline-offset-4">
          Try again
        </button>
      </div>
    );
  }
  const data = items.data ?? [];
  if (data.length === 0) return <EmptyState />;

  if (view === "priority") return <PriorityList key={list.id} listId={list.id} items={data} />;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-2 sm:px-8">
      <ul key={list.id} aria-label="Wishlist items" className={GRID_CLASS[size]}>
        {data.map((item, index) => (
          <li key={item.id}>
            <ItemCard item={item} index={index} mode={mode} income={income} onOpen={openItem} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Drag order is written to the cache while moving and sent to the server once the drag settles. */
function PriorityList({ listId, items }: { listId: string; items: Item[] }) {
  const qc = useQueryClient();
  const { mode, income, openItem } = useApp();
  const reorder = useReorder(listId);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onItemsChange = (next: Item[]) => {
    qc.setQueryData(
      itemsKey(listId),
      next.map((item, position) => ({ ...item, position })),
    );
    clearTimeout(timer.current);
    // The new order is already on screen; the hook rolls back with an error toast if the save fails.
    timer.current = setTimeout(() => reorder.mutate(next.map((i) => i.id)), 500);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-2 sm:px-8">
      <p className="mb-4 text-[13px] text-text-muted">The top item is the one you want most. Drag the handle, or focus it and use the arrow keys.</p>
      <div className="flex items-center gap-3 border-b border-border px-2 pb-2">
        <span aria-hidden className="w-9 shrink-0" />
        <div aria-hidden className={`${ROW} label text-text-faint`}>
          <span className="hidden sm:block">#</span>
          <span>Item</span>
          <span className="text-right">Now</span>
          <span className="hidden text-right sm:block">Since added</span>
          <span className="hidden text-right lg:block">Lowest</span>
          <span className="hidden text-right lg:block">Target</span>
        </div>
      </div>
      <SortableList
        items={items}
        onItemsChange={onItemsChange}
        label="Wishlist priority"
        getItemLabel={(i) => i.product.title}
        className="max-w-none"
      >
        {(ordered) => (
          <>
            <SortableListGroup className="space-y-0">
              {ordered.map((item, index) => (
                <SortableListItem
                  key={item.id}
                  id={item.id}
                  className="rounded-none border-0 border-b border-border bg-background px-2 py-2 transition-colors duration-[var(--dur-base)] hover:bg-surface-sunk"
                >
                  <SortableListHandle>
                    <GripVertical className="size-4" aria-hidden />
                  </SortableListHandle>
                  <SortableListItemContent className={ROW}>
                    <span className="hidden font-mono text-[12px] tabular-nums text-text-faint sm:block">{String(index + 1).padStart(2, "0")}</span>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="w-11 shrink-0">
                        <ProductImage
                          src={item.product.image_url}
                          alt=""
                          placeholderClassName="aspect-square"
                          className="aspect-square [&_img]:h-full [&_img]:object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openItem(item.id)}
                          className="block max-w-full truncate text-left text-[13px] font-medium hover:underline hover:underline-offset-4"
                        >
                          {item.product.title}
                        </button>
                        <p className="truncate text-[12px] text-text-muted">{retailerName(item.product.retailer, item.product.url)}</p>
                      </div>
                    </div>
                    <PriceFigure
                      minor={item.product.current_price_minor}
                      currency={item.product.currency}
                      mode={mode}
                      income={income}
                      index={index}
                      className="justify-self-end text-[13px] font-medium"
                    />
                    <div className="hidden justify-end sm:flex">
                      {item.stats.change_since_added_minor === 0 ? (
                        <span className="text-[12px] text-text-faint">No change</span>
                      ) : (
                        <DeltaChip changeMinor={item.stats.change_since_added_minor} currency={item.product.currency} />
                      )}
                    </div>
                    <div className="hidden justify-end text-[13px] text-text-muted lg:flex">
                      <PriceFigure minor={item.stats.lowest_minor} currency={item.product.currency} mode={mode} income={income} index={index} />
                    </div>
                    <div className="hidden justify-end text-[13px] text-text-muted lg:flex">
                      {item.target_price_minor ? (
                        <PriceFigure minor={item.target_price_minor} currency={item.product.currency} mode={mode} income={income} index={index} />
                      ) : (
                        <span className="text-text-faint">None</span>
                      )}
                    </div>
                  </SortableListItemContent>
                </SortableListItem>
              ))}
            </SortableListGroup>
            <SortableListUndo className="mt-3" />
          </>
        )}
      </SortableList>
    </div>
  );
}
