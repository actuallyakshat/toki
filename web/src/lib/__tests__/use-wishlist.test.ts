import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { itemsKey, listsKey, useAddItem, useDeleteItem, useUpdateItem } from "@/lib/hooks/use-wishlist";
import type { Item } from "@/lib/types";

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>();
  return { ...actual, api: { updateItem: vi.fn(), deleteItem: vi.fn(), addItem: vi.fn() } };
});

const item = (id: string, position: number, over: Partial<Item> = {}): Item =>
  ({ id, list_id: "l1", position, note: "", status: "wanted", target_price_minor: null, ...over }) as Item;

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
const cached = (status: "wanted" | "bought" = "wanted") => qc.getQueryData<Item[]>(itemsKey("l1", status));

/** A promise the test resolves or rejects by hand, to look at the cache mid-request. */
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  qc.setQueryData(itemsKey("l1"), [item("a", 0), item("b", 1)]);
  qc.setQueryData(itemsKey("l1", "bought"), [item("c", 0, { status: "bought" })]);
});
afterEach(() => vi.clearAllMocks());

describe("useUpdateItem", () => {
  it("applies an edit at once and keeps the server's version", async () => {
    const req = deferred<Item>();
    vi.mocked(api.updateItem).mockReturnValue(req.promise);
    const { result } = renderHook(() => useUpdateItem(), { wrapper });

    act(() => result.current.mutate({ id: "a", patch: { note: "draft" } }));
    await waitFor(() => expect(cached()?.[0]?.note).toBe("draft"));

    await act(async () => req.resolve(item("a", 0, { note: "saved by server" })));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cached()?.map((i) => i.note)).toEqual(["saved by server", ""]);
  });

  it("rolls back when the server refuses", async () => {
    const req = deferred<Item>();
    vi.mocked(api.updateItem).mockReturnValue(req.promise);
    const { result } = renderHook(() => useUpdateItem(), { wrapper });

    act(() => result.current.mutate({ id: "a", patch: { target_price_minor: 5 } }));
    await waitFor(() => expect(cached()?.[0]?.target_price_minor).toBe(5));

    await act(async () => req.reject(new ApiError(422, "validation_failed", "No.")));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached()?.[0]?.target_price_minor).toBeNull();
  });

  it("removes the item from its bucket on a status change and refetches every list", async () => {
    const req = deferred<Item>();
    vi.mocked(api.updateItem).mockReturnValue(req.promise);
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUpdateItem(), { wrapper });

    act(() => result.current.mutate({ id: "a", patch: { status: "bought" } }));
    await waitFor(() => expect(cached()?.map((i) => i.id)).toEqual(["b"]));

    await act(async () => req.resolve(item("a", 0, { status: "bought" })));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const keys = invalidate.mock.calls.map(([f]) => f?.queryKey);
    expect(keys).toContainEqual(["items"]);
    expect(keys).toContainEqual(listsKey);
  });
});

describe("useDeleteItem", () => {
  it("removes at once and restores on failure", async () => {
    const req = deferred<void>();
    vi.mocked(api.deleteItem).mockReturnValue(req.promise);
    const { result } = renderHook(() => useDeleteItem(), { wrapper });

    act(() => result.current.mutate("b"));
    await waitFor(() => expect(cached()?.map((i) => i.id)).toEqual(["a"]));
    await act(async () => req.reject(new ApiError(500, "internal", "Oops.")));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached()?.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("useAddItem", () => {
  it("inserts the new item in position order without duplicates", async () => {
    vi.mocked(api.addItem).mockResolvedValueOnce(item("z", 2)).mockResolvedValueOnce(item("a", 0, { note: "existing" }));
    const { result } = renderHook(() => useAddItem(), { wrapper });

    await act(() => result.current.mutateAsync({ url: "https://shop.test/z" }));
    expect(cached()?.map((i) => i.id)).toEqual(["a", "b", "z"]);

    // Adding something already in the list (server answers 200 with the existing item) must not duplicate it.
    await act(() => result.current.mutateAsync({ url: "https://shop.test/a" }));
    expect(cached()?.map((i) => i.id)).toEqual(["a", "b", "z"]);
    expect(cached()?.[0]?.note).toBe("existing");
  });
});
