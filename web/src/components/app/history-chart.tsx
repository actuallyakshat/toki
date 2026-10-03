"use client";

import { useMemo } from "react";
import {
  PriceTargetFan,
  PriceTargetFanAxes,
  PriceTargetFanCursor,
  PriceTargetFanHistory,
  PriceTargetFanNow,
  PriceTargetFanPlot,
  PriceTargetFanSvg,
  PriceTargetFanTargets,
  PriceTargetFanTooltip,
  type PriceHistoryPoint,
} from "@/components/charts/price-target-fan";
import { formatMoney } from "@/lib/format";
import { useHistory } from "@/lib/hooks/use-wishlist";
import type { Item, PricePoint } from "@/lib/types";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** The chart needs ascending, unique timestamps and positive prices. */
function toHistory(points: PricePoint[]): PriceHistoryPoint[] {
  const sorted = [...points]
    .filter((p) => p.price_minor > 0)
    .sort((a, b) => Date.parse(a.checked_at) - Date.parse(b.checked_at));
  const out: PriceHistoryPoint[] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (const p of sorted) {
    const t = Date.parse(p.checked_at);
    if (!Number.isFinite(t) || t <= last) continue;
    last = t;
    out.push({ date: p.checked_at, price: p.price_minor / 100 });
  }
  return out;
}

export function HistoryChart({ item }: { item: Item }) {
  const { data, isLoading, isError } = useHistory(item.id);
  const history = useMemo(() => toHistory(data ?? []), [data]);
  const currency = item.product.currency;
  const targetMinor = item.target_price_minor;
  const targets = useMemo(
    () => (targetMinor ? [{ key: "Your target", price: targetMinor / 100, color: "var(--down)" }] : []),
    [targetMinor],
  );

  if (isLoading) return <div aria-hidden className="h-52 animate-pulse rounded-image bg-surface-sunk" />;
  if (isError || history.length === 0) {
    return (
      <p className="rounded-image bg-surface-sunk p-4 text-[13px] text-text-muted">
        {isError
          ? "Toki could not load the price history. Close this panel and open it again."
          : "No price history yet. The chart fills in as the extension checks this price."}
      </p>
    );
  }

  return (
    <PriceTargetFan
      className="w-full"
      label="Price history for 90 days"
      current={item.product.current_price_minor / 100}
      history={history}
      targets={targets}
      format={(p) => formatMoney(Math.round(p * 100), currency)}
      formatAxis={(v) => compact.format(v)}
      dates={{ horizon: targetMinor ? "Target" : "Now" }}
    >
      <PriceTargetFanPlot>
        <PriceTargetFanSvg>
          <PriceTargetFanAxes />
          <PriceTargetFanHistory />
          <PriceTargetFanTargets />
          <PriceTargetFanNow />
          <PriceTargetFanCursor />
        </PriceTargetFanSvg>
        <PriceTargetFanTooltip />
      </PriceTargetFanPlot>
    </PriceTargetFan>
  );
}
