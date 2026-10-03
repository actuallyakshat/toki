import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/lib/api";
import { useUpdateProfile } from "@/lib/hooks/use-profile";
import { meKey, type MeData } from "@/lib/hooks/use-session";
import {
  itemsKey,
  listsKey,
  useAddItem,
  useCreateList,
  useDeleteItem,
  useReorder,
  useUpdateItem,
  useUpdateList,
} from "@/lib/hooks/use-wishlist";
import type { Item, List } from "@/lib/types";
import { deferred, item, list, profile, user } from "./fixtures";

const notify = vi.hoisted(() => vi.fn<(toast: unknown) => string>(() => "toast-id"));
vi.mock("@/components/providers/toast-provider", () => ({ useToast: () => notify }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: {
      addItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      reorder: vi.fn(),
      createList: vi.fn(),
      updateList: vi.fn(),
      updateProfile: vi.fn(),
    },
  };
});

const mocked = vi.mocked(api);
const failure = new ApiError(500, "internal", "Server is down.");

let qc: QueryClient;
function render<T>(hook: () => T) {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  return renderHook(hook, { wrapper });
}

const items = (listId = "l1") => qc.getQueryData<Item[]>(itemsKey(listId));
const lists = () => qc.getQueryData<List[]>(listsKey);
const lastToast = () => notify.mock.calls.at(-1)?.[0] as
  | { status: string; title: string; description: string; action?: { onClick: () => void } }
  | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(listsKey, [list("l1", { item_count: 1, total_minor: 1000 })]);
  qc.setQueryData(itemsKey("l1"), [item("a")]);
});

describe("useAddItem", () => {
  const body = { url: "https://shop.example/p/1", list_id: "l1" };

  it("shows a placeholder card before the server answers, then swaps in the real item", async () => {
    const pending = deferred<Item>();
    mocked.addItem.mockReturnValue(pending.promise);
    const { result } = render(useAddItem);

    act(() => result.current.mutate(body));
    await waitFor(() => expect(items()).toHaveLength(2));
    expect(items()![1].id).toContain("-optimistic-");
    expect(lists()![0].item_count).toBe(2);

    const saved = item("b", { position: 1 });
    await act(async () => pending.resolve(saved));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(items()!.map((i) => i.id)).toEqual(["a", "b"]);
    expect(lastToast()).toMatchObject({ status: "success", title: "Added to Toki", description: "Item b" });
  });

  it("rolls the placeholder back on failure, and Retry adds it again", async () => {
    mocked.addItem.mockRejectedValueOnce(failure);
    const { result } = render(useAddItem);

    act(() => result.current.mutate(body));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(items()!.map((i) => i.id)).toEqual(["a"]);
    expect(lastToast()).toMatchObject({ status: "error", title: "Toki could not add this item", description: "Server is down." });

    mocked.addItem.mockResolvedValueOnce(item("b"));
    act(() => lastToast()!.action!.onClick());
    await waitFor(() => expect(items()!.map((i) => i.id)).toEqual(["a", "b"]));
    expect(mocked.addItem).toHaveBeenCalledTimes(2);
  });
});

describe("useDeleteItem", () => {
  it("removes the card and lowers the sidebar count immediately", async () => {
    const pending = deferred<void>();
    mocked.deleteItem.mockReturnValue(pending.promise);
    const { result } = render(useDeleteItem);

    act(() => result.current.mutate("a"));
    await waitFor(() => expect(items()).toEqual([]));
    expect(lists()![0]).toMatchObject({ item_count: 0, total_minor: 0 });
    await act(async () => pending.resolve());
  });

  it("puts the card back with an error toast on failure", async () => {
    mocked.deleteItem.mockRejectedValueOnce(failure);
    const { result } = render(useDeleteItem);

    act(() => result.current.mutate("a"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(items()!.map((i) => i.id)).toEqual(["a"]);
    expect(lastToast()).toMatchObject({ status: "error", title: "Toki could not remove that item" });
  });
});

describe("useUpdateItem", () => {
  it("applies an edit in place before the server answers", async () => {
    const pending = deferred<Item>();
    mocked.updateItem.mockReturnValue(pending.promise);
    const { result } = render(useUpdateItem);

    act(() => result.current.mutate({ id: "a", patch: { note: "for the trip" } }));
    await waitFor(() => expect(items()![0].note).toBe("for the trip"));
    await act(async () => pending.resolve(item("a", { note: "for the trip" })));
  });

  it("takes the item out of the wanted list when it is marked bought", async () => {
    const pending = deferred<Item>();
    mocked.updateItem.mockReturnValue(pending.promise);
    const { result } = render(useUpdateItem);

    act(() => result.current.mutate({ id: "a", patch: { status: "bought" } }));
    await waitFor(() => expect(items()).toEqual([]));
    await act(async () => pending.resolve(item("a", { status: "bought" })));
  });

  it("restores the item and toasts on failure", async () => {
    mocked.updateItem.mockRejectedValueOnce(failure);
    const { result } = render(useUpdateItem);

    act(() => result.current.mutate({ id: "a", patch: { note: "lost" } }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(items()![0].note).toBe("");
    expect(lastToast()).toMatchObject({ status: "error", title: "Toki could not save that change" });
  });
});

describe("useReorder", () => {
  it("refetches the saved order and explains it on failure", async () => {
    mocked.reorder.mockRejectedValueOnce(failure);
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const { result } = render(() => useReorder("l1"));

    act(() => result.current.mutate(["a"]));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: itemsKey("l1") });
    expect(lastToast()).toMatchObject({
      title: "Toki could not save the order",
      description: "Server is down. The list went back to its saved order.",
    });
  });
});

describe("useCreateList", () => {
  it("adds a placeholder list in the profile currency, then swaps in the real one", async () => {
    qc.setQueryData<MeData>(meKey, { user, profile: profile({ currency: "USD" }) });
    const pending = deferred<List>();
    mocked.createList.mockReturnValue(pending.promise);
    const { result } = render(useCreateList);

    act(() => result.current.mutate({ name: "Gifts" }));
    await waitFor(() => expect(lists()).toHaveLength(2));
    expect(lists()![1]).toMatchObject({ name: "Gifts", currency: "USD" });
    expect(lists()![1].id).toContain("-optimistic-");

    await act(async () => pending.resolve(list("l2", { name: "Gifts" })));
    await waitFor(() => expect(lists()!.map((l) => l.id)).toEqual(["l1", "l2"]));
  });

  it("rolls back without a toast when the form shows the error inline", async () => {
    mocked.createList.mockRejectedValueOnce(failure);
    const { result } = render(() => useCreateList({ toastErrors: false }));

    act(() => result.current.mutate({ name: "Gifts" }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(lists()!.map((l) => l.id)).toEqual(["l1"]);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("useUpdateList", () => {
  it("renames immediately and rolls back with a toast on failure", async () => {
    const pending = deferred<List>();
    mocked.updateList.mockReturnValue(pending.promise);
    const { result } = render(useUpdateList);

    act(() => result.current.mutate({ id: "l1", name: "Home" }));
    await waitFor(() => expect(lists()![0].name).toBe("Home"));

    await act(async () => pending.reject(failure));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(lists()![0].name).toBe("List l1");
    expect(lastToast()).toMatchObject({ status: "error", title: "Toki could not save the list" });
  });
});

describe("useUpdateProfile", () => {
  beforeEach(() => qc.setQueryData<MeData>(meKey, { user, profile: profile() }));
  const me = () => qc.getQueryData<MeData>(meKey)!;

  it("flips a setting immediately and keeps the server's profile on success", async () => {
    const pending = deferred<{ profile: ReturnType<typeof profile> }>();
    mocked.updateProfile.mockReturnValue(pending.promise);
    const { result } = render(useUpdateProfile);

    act(() => result.current.mutate({ email_alerts: false }));
    await waitFor(() => expect(me().profile.email_alerts).toBe(false));

    await act(async () => pending.resolve({ profile: profile({ email_alerts: false, alert_mode: "digest" }) }));
    await waitFor(() => expect(me().profile.alert_mode).toBe("digest"));
  });

  it("rolls back with a toast on failure, or silently when the form shows the error", async () => {
    mocked.updateProfile.mockRejectedValue(failure);
    const loud = render(useUpdateProfile).result;
    act(() => loud.current.mutate({ email_alerts: false }));
    await waitFor(() => expect(loud.current.isError).toBe(true));
    expect(me().profile.email_alerts).toBe(true);
    expect(notify).toHaveBeenCalledOnce();

    const quiet = render(() => useUpdateProfile({ toastErrors: false })).result;
    act(() => quiet.current.mutate({ alert_mode: "digest" }));
    await waitFor(() => expect(quiet.current.isError).toBe(true));
    expect(me().profile.alert_mode).toBe("instant");
    expect(notify).toHaveBeenCalledOnce();
  });
});
