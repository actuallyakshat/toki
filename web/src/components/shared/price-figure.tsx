"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { DigitSwap } from "@/components/motion/digit-swap";
import { formatMoney, formatTime, type Income } from "@/lib/format";
import type { Mode } from "@/lib/mode";
import { cn } from "@/lib/utils";

const STAGGER_MS = 25;
const MAX_STAGGER_STEPS = 24;

/** Each figure follows the mode `index * 25 ms` late, so the toggle ripples across the grid. */
function useStaggeredMode(mode: Mode, index: number): Mode {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(mode);
  useEffect(() => {
    if (reduce) {
      const id = setTimeout(() => setShown(mode), 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setShown(mode), Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS);
    return () => clearTimeout(id);
  }, [mode, index, reduce]);
  return shown;
}

export function priceText(minor: number, currency: string, mode: Mode, income: Income | null): string {
  return mode === "time" && income ? formatTime(minor, income) : formatMoney(minor, currency);
}

interface Props {
  minor: number;
  currency: string;
  mode: Mode;
  income: Income | null;
  /** Position in the grid, used for the stagger. */
  index?: number;
  className?: string;
}

/** A price that rolls between rupees and hours of work. */
export function PriceFigure({ minor, currency, mode, income, index = 0, className }: Props) {
  const shown = useStaggeredMode(mode, index);
  const text = priceText(minor, currency, shown, income);
  return (
    <DigitSwap
      value={text}
      animationKey={shown}
      direction="up"
      fit
      duration={0.28}
      stagger={0.018}
      className={cn("figure", className)}
    />
  );
}
