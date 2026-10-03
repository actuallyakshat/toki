"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ToastInput } from "@/components/motion/animated-toast-stack";
import { errorMessage } from "@/lib/api";
import { DEFAULT_LIST_ICON } from "@/lib/list-icon-value";
import type { Capture, Item, List } from "@/lib/types";

let tempSeed = 0;

/** Client-only placeholder id. Replaced with the server id on success. */
function tempId(prefix: string): string {
  tempSeed += 1;
  return `${prefix}-optimistic-${Date.now().toString(36)}-${tempSeed}`;
}

/** The error toast every optimistic mutation shows after rolling back. Retry re-runs the mutation. */
export function failureToast(
  notify: (toast: ToastInput) => string,
  title: string,
  e: unknown,
  retry?: () => void,
  suffix = "",
) {
  notify({
    status: "error",
    title,
    description: suffix ? `${errorMessage(e)} ${suffix}` : errorMessage(e),
    action: retry ? { label: "Retry", onClick: retry } : undefined,
  });
}

/** Cancels in-flight fetches for `key`, applies `fn`, and returns the previous value for rollback. */
export async function setOptimistic<T>(qc: QueryClient, key: QueryKey, fn: (old: T | undefined) => T | undefined) {
  await qc.cancelQueries({ queryKey: key });
  const previous = qc.getQueryData<T>(key);
  qc.setQueryData<T>(key, fn);
  return previous;
}

/** Placeholder item shown in the grid the moment the user presses Add. */
export function buildOptimisticItem(
  body: { url: string; list_id?: string; capture?: Capture; target_price_minor?: number },
  fallbackListId: string,
  position: number,
): { item: Item; listId: string } {
  const capture = body.capture;
  const price = capture?.price_minor ?? 0;
  const currency = capture?.currency ?? "INR";
  const listId = body.list_id ?? fallbackListId;
  const title = capture?.title || "Adding item…";
  return {
    listId,
    item: {
      id: tempId("item"),
      list_id: listId,
      product: {
        id: tempId("product"),
        url: capture?.source_url ?? body.url,
        retailer: capture?.retailer ?? "generic",
        title,
        image_url: capture?.image_url ?? "",
        currency,
        current_price_minor: price,
        original_price_minor: capture?.original_price_minor ?? null,
        in_stock: capture?.in_stock ?? true,
        last_checked_at: null,
        last_check_status: "pending",
      },
      added_price_minor: price,
      target_price_minor: body.target_price_minor ?? null,
      alert_rule: { type: "any_drop" },
      note: "",
      position,
      status: "wanted",
      cooling_until: null,
      created_at: new Date().toISOString(),
      bought_at: null,
      stats: { lowest_minor: price, highest_minor: price, change_since_added_minor: 0 },
    },
  };
}

/** Placeholder list shown in the sidebar the moment the user presses Create. */
export function buildOptimisticList(body: { name: string; emoji?: string }, currency = "INR"): List {
  return {
    id: tempId("list"),
    name: body.name,
    emoji: body.emoji ?? DEFAULT_LIST_ICON,
    visibility: "private",
    share_slug: "",
    item_count: 0,
    total_minor: 0,
    currency,
    created_at: new Date().toISOString(),
  };
}
