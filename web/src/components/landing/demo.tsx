"use client";

import { useEffect } from "react";
import { TiltCard } from "@/components/motion/tilt-card";
import { ModeToggle } from "@/components/shared/mode-toggle";
import { ProductCard } from "@/components/shared/product-card";
import { setMode, useMode } from "@/lib/mode";
import { DEMO_CARDS, DEMO_INCOME } from "./sample";

/** Live demo of the currency / time toggle. It shares the page-wide mode, so the accent changes too. */
export function Demo() {
  const mode = useMode();

  useEffect(() => () => setMode("money", { persist: false }), []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="max-w-md text-[13px] leading-[1.6] text-text-muted">
          Press the switch. This demo assumes a salary of ₹1,20,000 a month and 45 hours a week. In Toki, you enter your own.
        </p>
        <ModeToggle mode={mode} onChange={(m) => setMode(m, { persist: false })} />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {DEMO_CARDS.map(({ imageClassName, ...card }, i) => (
          <TiltCard key={card.title} max={6} glare={false} className="h-full overflow-visible rounded-[var(--radius-card)]">
            <ProductCard
              data={card}
              mode={mode}
              income={DEMO_INCOME}
              index={i}
              imageClassName={imageClassName}
              className="h-full"
            />
          </TiltCard>
        ))}
      </div>
    </div>
  );
}
