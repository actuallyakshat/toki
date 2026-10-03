import type { ReactNode } from "react";

export interface PriceTarget {
  key: string;
  price: number;
  /** Any CSS color; the projection, its dot and its label take it. */
  color?: string;
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
}

export type PriceTargetFanActive = { type: "history"; date: string } | { type: "target"; key: string };

export interface PriceTargetFanProps {
  /** Accessible name of the chart. */
  label?: string;
  /** Last traded price; the history walks to this point. */
  current: number;
  /** Up to three target lines drawn from the current price. May be empty. */
  targets: PriceTarget[];
  /** Formats a price for labels and tooltips. Defaults to two decimals. */
  format?: (price: number) => string;
  /** Formats the gridline labels on the price axis. */
  formatAxis?: (price: number) => string;
  /** Axis labels, oldest to horizon. */
  dates?: { start?: string; mid?: string; horizon?: string };
  /** Actual prices, oldest first, using ISO dates. Empty history renders only the current price and targets. */
  history?: PriceHistoryPoint[];
  children?: ReactNode;
  active?: PriceTargetFanActive | null;
  defaultActive?: PriceTargetFanActive | null;
  onActiveChange?: (active: PriceTargetFanActive | null) => void;
  className?: string;
}
