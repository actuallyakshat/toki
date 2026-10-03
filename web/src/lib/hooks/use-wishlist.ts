"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers/toast-provider";
import { api, type ItemPatch, type NewItem } from "@/lib/api";
import { buildOptimisticItem, buildOptimisticList, failureToast, setOptimistic } from "@/lib/optimistic";
import type { Item, ItemStatus, List } from "@/lib/types";
import { meKey, type MeData } from "./use-session";

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

function snapshotItems(qc: QueryClient): ItemsSnapshot {
  return qc.getQueriesData<Item[]>({ queryKey: ["items"] }) as ItemsSnapshot;
}

/** Applies `fn` to every cached items query and returns the previous values for rollback. */
function mapItemCaches(qc: QueryClient, fn: (items: Item[]) => Item[]): ItemsSnapshot {
  const snapshot = snapshotItems(qc);
  for (const [key, items] of snapshot) {
    if (!items) continue;
    const next = fn(items);
    if (next !== items) qc.setQueryData(key, next);
  }
  return snapshot;
}

function restoreItems(qc: QueryClient, snapshot: ItemsSnapshot | undefined) {
  snapshot?.forEach(([key, items]) => qc.setQueryData(key, items));
}

/** Sidebar badges follow the grid instantly; the settled refetch corrects them. */
function bumpListCount(qc: QueryClient, listId: string, deltaCount: number, deltaTotal: number) {
  qc.setQueryData<List[]>(listsKey, (lists) =>
    lists?.map((l) =>
      l.id === listId
        ? { ...l, item_count: Math.max(0, l.item_count + deltaCount), total_minor: Math.max(0, l.total_minor + deltaTotal) }
        : l,
    ),
  );
}

/** Reorder is applied by the drag list before the server call; a failure refetches the true order. */
export function useReorder(listId: string | undefined) {
  const qc = useQueryClient();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: (ids: string[]) => api.reorder(listId!, ids),
    onError: (e, ids) => {
      qc.invalidateQueries({ queryKey: itemsKey(listId!) });
      failureToast(
        notify,
        "Toki could not save the order",
        e,
        () => mutation.mutate(ids),
        "The list went back to its saved order.",
      );
    },
  });
  return mutation;
}

/** Instant edit of target, alert rule, note, status and cooling-off. Rolls back with an error toast. */
export function useUpdateItem() {
  const qc = useQueryClient();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ItemPatch }) => api.updateItem(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["items"] });
      const moving = patch.list_id !== undefined;
      // A status change or a move leaves the current bucket; the settled refetch puts it right.
      const leaves = Boolean(patch.status && patch.status !== "wanted") || moving;
      const snapshot = mapItemCaches(qc, (items) =>
        leaves
          ? items.filter((i) => i.id !== id)
          : items.map((i) => (i.id === id ? ({ ...i, ...patch }) as Item : i)),
      );
      return { snapshot };
    },
    onError: (e, variables, ctx) => {
      restoreItems(qc, ctx?.snapshot);
      failureToast(notify, "Toki could not save that change", e, () => mutation.mutate(variables));
    },
    onSuccess: (item, { patch }) => {
      if (!patch.status && patch.list_id === undefined) {
        mapItemCaches(qc, (items) => items.map((i) => (i.id === item.id ? item : i)));
      }
    },
    onSettled: (_d, _e, { patch }) => {
      qc.invalidateQueries({ queryKey: listsKey });
      qc.invalidateQueries({ queryKey: statsKey });
      if (patch.status || patch.list_id !== undefined) qc.invalidateQueries({ queryKey: ["items"] });
    },
  });
  return mutation;
}

/** Instant remove. Rolls back with an error toast. Undo is offered through the caller's success toast. */
export function useDeleteItem() {
  const qc = useQueryClient();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["items"] });
      const snapshot = mapItemCaches(qc, (items) => items.filter((i) => i.id !== id));
      const current = snapshot.flatMap(([, items]) => items ?? []).find((i) => i.id === id);
      if (current) bumpListCount(qc, current.list_id, -1, -current.product.current_price_minor);
      return { snapshot };
    },
    onError: (e, id, ctx) => {
      restoreItems(qc, ctx?.snapshot);
      failureToast(notify, "Toki could not remove that item", e, () => mutation.mutate(id));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: listsKey });
      qc.invalidateQueries({ queryKey: statsKey });
    },
  });
  return mutation;
}

/** Instant add: a placeholder card appears before the server answers, then swaps for the real item. */
export function useAddItem() {
  const qc = useQueryClient();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: (body: NewItem) => api.addItem(body),
    onMutate: async (body) => {
      const lists = qc.getQueryData<List[]>(listsKey);
      const fallbackListId = body.list_id ?? lists?.[0]?.id ?? "";
      const key = itemsKey(fallbackListId);
      await qc.cancelQueries({ queryKey: key });
      const wanted = qc.getQueryData<Item[]>(key);
      const { item, listId } = buildOptimisticItem(body, fallbackListId, wanted?.length ?? 0);
      if (fallbackListId) {
        qc.setQueryData<Item[]>(key, [...(wanted ?? []), item]);
        bumpListCount(qc, listId, 1, item.product.current_price_minor);
      }
      return { key, wanted, tempId: item.id };
    },
    onError: (e, body, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.wanted);
      failureToast(notify, "Toki could not add this item", e, () => mutation.mutate(body));
    },
    onSuccess: (item, _body, ctx) => {
      // The server may answer with an item already in the list, or file it under another list.
      qc.setQueryData<Item[]>(ctx.key, (items) => items?.filter((i) => i.id !== ctx.tempId));
      qc.setQueryData<Item[]>(itemsKey(item.list_id), (items) =>
        items ? [...items.filter((i) => i.id !== item.id), item].sort((a, b) => a.position - b.position) : items,
      );
      notify({ status: "success", title: "Added to Toki", description: item.product.title });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: listsKey });
      qc.invalidateQueries({ queryKey: statsKey });
    },
  });
  return mutation;
}

export function useRefreshItem() {
  const notify = useToast();
  return useMutation({
    mutationFn: (id: string) => api.refresh(id),
    onError: (e) => failureToast(notify, "Toki could not queue the check", e),
  });
}

/**
 * Instant create: the sidebar shows the list before the server answers, then swaps in the real id.
 * Forms that show the failure inline pass `toastErrors: false`.
 */
export function useCreateList({ toastErrors = true } = {}) {
  const qc = useQueryClient();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: (body: { name: string; emoji?: string }) => api.createList(body),
    onMutate: async (body) => {
      const currency =
        qc.getQueryData<MeData>(meKey)?.profile.currency ?? qc.getQueryData<List[]>(listsKey)?.[0]?.currency ?? "INR";
      const optimistic = buildOptimisticList(body, currency);
      const previous = await setOptimistic<List[]>(qc, listsKey, (lists) => [...(lists ?? []), optimistic]);
      return { previous, tempId: optimistic.id };
    },
    onError: (e, body, ctx) => {
      qc.setQueryData(listsKey, ctx?.previous);
      if (toastErrors) failureToast(notify, "Toki could not create the list", e, () => mutation.mutate(body));
    },
    onSuccess: (list, _body, ctx) => {
      qc.setQueryData<List[]>(listsKey, (lists) => lists?.map((l) => (l.id === ctx.tempId ? list : l)) ?? [list]);
    },
  });
  return mutation;
}

/** Instant rename / icon / sharing toggle. Rolls back with an error toast unless `toastErrors` is false. */
export function useUpdateList({ toastErrors = true } = {}) {
  const qc = useQueryClient();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<Pick<List, "name" | "emoji" | "visibility">>) =>
      api.updateList(id, patch),
    onMutate: async ({ id, ...patch }) => ({
      previous: await setOptimistic<List[]>(qc, listsKey, (lists) =>
        lists?.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      ),
    }),
    onError: (e, variables, ctx) => {
      qc.setQueryData(listsKey, ctx?.previous);
      if (toastErrors) failureToast(notify, "Toki could not save the list", e, () => mutation.mutate(variables));
    },
    onSuccess: (list) =>
      qc.setQueryData<List[]>(listsKey, (lists) => lists?.map((l) => (l.id === list.id ? list : l))),
  });
  return mutation;
}
