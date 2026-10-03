import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Jade when the price fell since added, kumkum when it rose. Hidden when unchanged. */
export function DeltaChip({ changeMinor, currency, className }: { changeMinor: number; currency: string; className?: string }) {
  if (changeMinor === 0) return null;
  const down = changeMinor < 0;
  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-[12px] font-medium",
        down
          ? "bg-down/12 text-down"
          : "bg-up/12 text-up",
        className,
      )}
    >
      <span aria-hidden className="text-[9px]">{down ? "▼" : "▲"}</span>
      <span className="sr-only">{down ? "Down" : "Up"} </span>
      {formatMoney(Math.abs(changeMinor), currency)}
    </span>
  );
}
