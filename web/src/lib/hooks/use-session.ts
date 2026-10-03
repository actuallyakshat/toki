"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const meKey = ["me"] as const;

export type MeData = Awaited<ReturnType<typeof api.me>>;

/** The signed-in user and profile. A 401 resolves as an error with status 401. */
export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: api.me, retry: false, staleTime: 60_000 });
}
