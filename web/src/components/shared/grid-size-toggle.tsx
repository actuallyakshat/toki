"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { type GridSize, setGridSize, useGridSize } from "@/lib/grid-size";

const SIZES: { value: GridSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

const NAMES: Record<GridSize, string> = { small: "Small cards", medium: "Medium cards", large: "Large cards" };

/** Small / medium / large card switch, shared by every product grid. */
export function GridSizeToggle() {
  const size = useGridSize();
  return (
    <div role="group" aria-label="Card size">
    <Tabs variant="segment" value={size} onValueChange={(v) => setGridSize(v as GridSize)}>
      <TabsList
        className="rounded-[var(--radius-control)] border border-border p-1 [&_[role=tab]]:rounded-[4px] [&_[role=tab]]:text-[13px]"
        wrapperClassName="w-auto"
      >
        {SIZES.map((s) => (
          <TabsTrigger key={s.value} value={s.value} className="w-9 px-0" indicatorClassName="rounded-[4px]">
            <span aria-hidden>{s.label}</span>
            <span className="sr-only">{NAMES[s.value]}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
    </div>
  );
}
