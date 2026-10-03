"use client";

import { Clock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import type { Mode } from "@/lib/mode";

/** The currency / time switch. The segment indicator uses --accent, so it turns purple in time mode. */
export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <Tabs variant="segment" value={mode} onValueChange={(v) => onChange(v as Mode)}>
      <TabsList
        className="rounded-[var(--radius-control)] border border-border p-1 [&_[role=tab]]:min-h-9 [&_[role=tab]]:text-[13px] [&_[role=tab]]:rounded-[4px]"
        wrapperClassName="w-auto"
      >
        <TabsTrigger
          value="money"
          className="gap-1.5 px-3"
          indicatorClassName="accent-surface rounded-[4px]"
        >
          <span aria-hidden>₹</span>
          <span className="sr-only">Show prices in rupees</span>
        </TabsTrigger>
        <TabsTrigger
          value="time"
          className="gap-1.5 px-3"
          indicatorClassName="accent-surface rounded-[4px]"
        >
          <Clock className="size-4" aria-hidden />
          <span>Hours</span>
          <span className="sr-only"> of work</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
