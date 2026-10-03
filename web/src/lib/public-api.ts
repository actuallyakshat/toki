import { cache } from "react";
import type { PublicList } from "./types";

const ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8080";

/** Server-side fetch for the shared list. One call serves both the page and its metadata. */
export const getPublicList = cache(async (slug: string): Promise<PublicList | null> => {
  try {
    const res = await fetch(`${ORIGIN}/api/public/lists/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicList;
  } catch {
    return null;
  }
});
