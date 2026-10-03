"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api, type ItemPatch, type NewItem } from "@/lib/api";
import type { Item, ItemStatus, List } from "@/lib/types";

export const listsKey = ["lists"] as const;
export const itemsKey = (listId: string, status: ItemStatus | "all" = "wanted") => ["items", listId, status] as const;
export const statsKey = ["stats"] as const;
export const historyKey = (itemId: string) => ["history", itemId] as const;

export function useLists() {
  return useQuery({ queryKey: listsKey, queryFn: async () => (await api.lists()).lists });
}

export function useItems(listId: string | undefined, status: ItemStatus | "all" = "wanted") {
  return useQuery({
    queryKey: itemsKey(listId ?? "", status),
    queryFn: async () => (await api.items(listId!, status)).items,
    enabled: Boolean(listId),
  });
}

export function useStats() {
  return useQuery({ queryKey: statsKey, queryFn: api.stats });
}

export function useHistory(itemId: string | undefined) {
  return useQuery({
    queryKey: historyKey(itemId ?? ""),
    queryFn: async () => (await api.history(itemId!)).points,
    enabled: Boolean(itemId),
  });
}

type ItemsSnapshot = [readonly unknown[], Item[] | undefined][];

/** Applies `fn` to every cached items query and returns the previous values for rollback. */
function mapItemCaches(qc: QueryClient, fn: (items: Item[]) => Item[]): ItemsSnapshot {
  const snapshot = qc.getQueriesData<Item[]>({ queryKey: ["items"] }) as ItemsSnapshot;
  for (const [key, items] of snapshot) {
    if (items) qc.setQueryData(key, fn(items));
  }
  return snapshot;
}

function restore(qc: QueryClient, snapshot: ItemsSnapshot | undefined) {
  snapshot?.forEach(([key, items]) => qc.setQueryData(key, items));
}

/** The caller updates the cache while dragging and sends the final order once. A failure refetches the true order. */
export function useReorder(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.reorder(listId!, ids),
    onError: () => qc.invalidateQueries({ queryKey: itemsKey(listId!) }),
  });
}

/** Optimistic edit of target, alert rule, note, status and cooling-off. */
export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ItemPatch }) => api.updateItem(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["items"] });
      // A status change moves the item to another bucket; the settled refetch puts it there.
      const leaves = Boolean(patch.status);
      const snapshot = mapItemCaches(qc, (items) =>
        leaves
          ? items.filter((i) => i.id !== id)
          : items.map((i) => (i.id === id ? ({ ...i, ...patch } as Item) : i)),
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshot),
    onSuccess: (item, { patch }) => {
      if (!patch.status) mapItemCaches(qc, (items) => items.map((i) => (i.id === item.id ? item : i)));
    },
    onSettled: (_d, _e, { patch }) => {
      qc.invalidateQueries({ queryKey: listsKey });
      qc.invalidateQueries({ queryKey: statsKey });
      if (patch.status) qc.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["items"] });
      return { snapshot: mapItemCaches(qc, (items) => items.filter((i) => i.id !== id)) };
    },
    onError: (_e, _id, ctx) => restore(qc, ctx?.snapshot),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: listsKey });
      qc.invalidateQueries({ queryKey: statsKey });
    },
  });
}

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewItem) => api.addItem(body),
    onSuccess: (item) => {
      qc.setQueryData<Item[]>(itemsKey(item.list_id), (items) =>
        items ? [...items.filter((i) => i.id !== item.id), item].sort((a, b) => a.position - b.position) : items,
      );
      qc.invalidateQueries({ queryKey: listsKey });
    },
  });
}

export function useRefreshItem() {
  return useMutation({ mutationFn: (id: string) => api.refresh(id) });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; emoji?: string }) => api.createList(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: listsKey }),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<Pick<List, "name" | "emoji" | "visibility">>) =>
      api.updateList(id, patch),
    onSuccess: (list) =>
      qc.setQueryData<List[]>(listsKey, (lists) => lists?.map((l) => (l.id === list.id ? list : l))),
  });
}
