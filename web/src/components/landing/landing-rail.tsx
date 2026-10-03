"use client";

import { useEffect, useState } from "react";
import { PreviewRail, type PreviewRailItem } from "@/components/motion/preview-rail";

const SECTIONS: PreviewRailItem[] = [
  { id: "top", label: "Toki", description: "A wishlist that shows prices in hours of work.", href: "#top" },
  { id: "how", label: "How it works", description: "Add from any store, your browser checks the price, one email per drop.", href: "#how" },
  { id: "time", label: "Time view", description: "The same price is a different amount of your life.", href: "#time" },
  { id: "self-host", label: "Self-host", description: "Postgres, the API and the website on your own machine.", href: "#self-host" },
];

/** Section ticks pinned to the right edge, after Synara's homepage rail. Follows the scroll position. */
export function LandingRail() {
  const [active, setActive] = useState("top");

  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
        const first = SECTIONS.find((s) => seen.get(s.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pointer-events-none fixed right-3 top-1/2 z-40 hidden w-80 -translate-y-1/2 lg:block">
      <PreviewRail
        items={SECTIONS}
        label="Page sections"
        activeId={active}
        onActiveChange={setActive}
        previewSide="before"
        className="min-h-0"
        railClassName="pointer-events-auto ml-auto"
      />
    </div>
  );
}
