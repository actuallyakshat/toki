"use client";

import type { ReactNode } from "react";
import { formatDayMonth, faviconUrl, isCooling } from "@/lib/format";
import type { Income } from "@/lib/format";
import type { Mode } from "@/lib/mode";
import { cn } from "@/lib/utils";
import { DeltaChip } from "./delta-chip";
import { PriceFigure } from "./price-figure";
import { ProductImage } from "./product-image";

export interface CardData {
  title: string;
  imageUrl: string;
  retailer: string;
  /** Used for the favicon. */
  url: string;
  priceMinor: number;
  currency: string;
  changeMinor: number;
  coolingUntil?: string | null;
  inStock?: boolean;
}

interface Props {
  data: CardData;
  mode: Mode;
  income: Income | null;
  index: number;
  onOpen?: () => void;
  imageClassName?: string;
  className?: string;
  footer?: ReactNode;
}

export function ProductCard({ data, mode, income, index, onOpen, imageClassName, className, footer }: Props) {
    const favicon = faviconUrl(data.url);
  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-card bg-surface p-2.5 shadow-card transition-shadow duration-[var(--dur-base)] hover:shadow-lift",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
        className,
      )}
    >
      <ProductImage src={data.imageUrl} alt="" className={imageClassName} />
      <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-3">
        <p className="flex items-center gap-1.5 text-[12px] text-text-muted">
          {favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={favicon} alt="" width={14} height={14} className="size-3.5 rounded-sm" />
          )}
          <span className="truncate">{data.retailer}</span>
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-[2lh] font-body text-[13px] font-medium leading-snug tracking-normal">
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className="text-left outline-none after:absolute after:inset-0 after:rounded-card after:content-['']"
            >
              {data.title}
            </button>
          ) : (
            data.title
          )}
        </h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-2.5">
          <PriceFigure
            minor={data.priceMinor}
            currency={data.currency}
            mode={mode}
            income={income}
            index={index}
            className="text-[17px] font-medium"
          />
          <DeltaChip changeMinor={data.changeMinor} currency={data.currency} />
        </div>
        {data.inStock === false && <p className="mt-1.5 text-[12px] text-up">Out of stock</p>}
        {isCooling(data.coolingUntil) && (
          <p className="mt-1.5 text-[12px] text-text-muted">Cooling off until {formatDayMonth(data.coolingUntil)}</p>
        )}
        {footer && <div className="relative z-10 mt-3">{footer}</div>}
      </div>
    </article>
  );
}
