"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { useApp } from "@/components/app/app-context";
import Link from "next/link";
import { UNIFORM_IMAGE, toCardData } from "@/components/app/item-card";
import { TokiButton } from "@/components/shared/buttons";
import { GridSizeToggle } from "@/components/shared/grid-size-toggle";
import { ProductCard } from "@/components/shared/product-card";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { GRID_CLASS, useGridSize } from "@/lib/grid-size";
import { itemsKey, useStats, useUpdateItem } from "@/lib/hooks/use-wishlist";
import type { Item } from "@/lib/types";

const BOUGHT_ON = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function BoughtPage() {
  const { lists, mode, income, currency } = useApp();
  const stats = useStats();
  const size = useGridSize();
  const update = useUpdateItem();
  const results = useQueries({
    queries: lists.map((l) => ({
      queryKey: itemsKey(l.id, "bought"),
      queryFn: async () => (await api.items(l.id, "bought")).items,
    })),
  });
  const loading = results.some((r) => r.isLoading);
  const items = useMemo(() => results.flatMap((r) => r.data ?? []), [results]);
  const notSpent = stats.data?.removed_value_minor ?? 0;
  const saved = stats.data?.saved_by_drops_minor ?? 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-8 sm:px-8">
      <h1 className="text-[22px] leading-tight sm:text-[32px]">Bought</h1>

      {/* One full-width strip of figures, split by hairlines. */}
      <dl className="mt-6 grid border-y border-border sm:grid-cols-3">
        <div className="border-border p-5 max-sm:border-b sm:border-r sm:pl-0">
          <dt className="label text-text-faint">Money not spent</dt>
          <dd className="figure tnum mt-3 text-[28px]">{formatMoney(notSpent, stats.data?.currency ?? currency)}</dd>
          <p className="mt-1 text-[12px] text-text-muted">The price of everything you took off your wishlist.</p>
        </div>
        <div className="border-border p-5 max-sm:border-b sm:border-r">
          <dt className="label text-text-faint">Saved by price drops</dt>
          <dd className="figure tnum mt-3 text-[28px] text-down">{formatMoney(saved, stats.data?.currency ?? currency)}</dd>
          <p className="mt-1 text-[12px] text-text-muted">The gap between the price you added and the price you paid.</p>
        </div>
        <div className="p-5">
          <dt className="label text-text-faint">Things bought</dt>
          <dd className="figure tnum mt-3 text-[28px]">{loading ? "–" : items.length}</dd>
          <p className="mt-1 text-[12px] text-text-muted">Items you marked as bought, across every list.</p>
        </div>
      </dl>

      <div className="mt-10 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium tracking-[-0.01em]">Things you bought</h2>
        {items.length > 0 && <GridSizeToggle />}
      </div>
      {loading ? (
        <div aria-hidden className={`mt-4 ${GRID_CLASS[size]}`}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-card bg-surface-sunk" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border px-6 py-16 text-center">
          <p className="max-w-md text-[13px] leading-relaxed text-text-muted">
            Nothing here yet. When you press Mark as bought on an item, it moves to this page.
          </p>
          <Link href="/app" className="text-[13px] font-medium text-highlight hover:underline hover:underline-offset-4">
            Go to your wishlist
          </Link>
        </div>
      ) : (
        <ul className={`mt-4 ${GRID_CLASS[size]}`}>
          {items.map((item: Item, i) => (
            <li key={item.id}>
              <ProductCard
                className="h-full"
                imageClassName={UNIFORM_IMAGE}
                data={toCardData(item)}
                mode={mode}
                income={income}
                index={i}
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-text-muted">
                    {item.bought_at ? (
                      <>
                        Bought on <time dateTime={item.bought_at}>{BOUGHT_ON.format(new Date(item.bought_at))}</time>
                      </>
                    ) : (
                      "Purchase date not recorded"
                    )}
                  </p>
                  <TokiButton
                    size="sm"
                    variant="secondary"
                    onClick={() => update.mutate({ id: item.id, patch: { status: "wanted" } })}
                  >
                    Back to wishlist
                  </TokiButton>
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
