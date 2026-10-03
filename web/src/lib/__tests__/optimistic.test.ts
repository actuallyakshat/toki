import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { AnimatedToast, ToastInput } from "@/components/motion/animated-toast-stack";
import { ApiError, errorMessage } from "@/lib/api";
import { DEFAULT_LIST_ICON } from "@/lib/list-icon-value";
import { buildOptimisticItem, buildOptimisticList, failureToast, setOptimistic } from "@/lib/optimistic";
import type { Capture } from "@/lib/types";

const capture: Capture = {
  source_url: "https://shop.example/p/1",
  title: "Headphones",
  image_url: "https://img.example/1.jpg",
  price_minor: 499900,
  currency: "INR",
  original_price_minor: 599900,
  in_stock: false,
  retailer: "amazon_in",
};

describe("errorMessage", () => {
  it("uses the server's sentence for an ApiError", () => {
    expect(errorMessage(new ApiError(422, "validation_failed", "Name is too long."), "fallback")).toBe("Name is too long.");
  });

  it("uses the caller's fallback for anything else", () => {
    expect(errorMessage(new TypeError("Failed to fetch"), "Toki could not save.")).toBe("Toki could not save.");
    expect(errorMessage("boom")).toBe("Something went wrong. Try again.");
  });
});

describe("buildOptimisticItem", () => {
  it("fills the placeholder from the capture", () => {
    const { item, listId } = buildOptimisticItem(
      { url: "https://shop.example/p/1", list_id: "l2", capture, target_price_minor: 400000 },
      "l1",
      3,
    );
    expect(listId).toBe("l2");
    expect(item.list_id).toBe("l2");
    expect(item.position).toBe(3);
    expect(item.status).toBe("wanted");
    expect(item.target_price_minor).toBe(400000);
    expect(item.added_price_minor).toBe(499900);
    expect(item.product).toMatchObject({
      title: "Headphones",
      retailer: "amazon_in",
      current_price_minor: 499900,
      original_price_minor: 599900,
      in_stock: false,
      last_check_status: "pending",
    });
    expect(item.stats).toEqual({ lowest_minor: 499900, highest_minor: 499900, change_since_added_minor: 0 });
  });

  it("falls back to the given list and a pending title without a capture", () => {
    const { item, listId } = buildOptimisticItem({ url: "https://shop.example/p/2" }, "l1", 0);
    expect(listId).toBe("l1");
    expect(item.product.title).toBe("Adding item…");
    expect(item.product.url).toBe("https://shop.example/p/2");
    expect(item.product.current_price_minor).toBe(0);
    expect(item.target_price_minor).toBeNull();
  });

  it("gives every placeholder a distinct optimistic id", () => {
    const a = buildOptimisticItem({ url: "x" }, "l1", 0).item;
    const b = buildOptimisticItem({ url: "x" }, "l1", 0).item;
    expect(a.id).not.toBe(b.id);
    expect(a.id).toContain("-optimistic-");
  });
});

describe("buildOptimisticList", () => {
  it("uses the default icon and the given currency", () => {
    const l = buildOptimisticList({ name: "Gifts" }, "USD");
    expect(l).toMatchObject({ name: "Gifts", emoji: DEFAULT_LIST_ICON, currency: "USD", item_count: 0, visibility: "private" });
    expect(l.id).toContain("-optimistic-");
  });

  it("keeps a chosen icon", () => {
    expect(buildOptimisticList({ name: "Home", emoji: "i:home" }).emoji).toBe("i:home");
  });
});

describe("setOptimistic", () => {
  it("cancels in-flight fetches, applies the update, and returns the previous value", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["n"], 1);
    const cancel = vi.spyOn(qc, "cancelQueries");
    const previous = await setOptimistic<number>(qc, ["n"], (n) => (n ?? 0) + 1);
    expect(cancel).toHaveBeenCalledWith({ queryKey: ["n"] });
    expect(previous).toBe(1);
    expect(qc.getQueryData(["n"])).toBe(2);
  });
});

describe("failureToast", () => {
  it("shows an error toast with a Retry action that re-runs the mutation", () => {
    const notify = vi.fn<(toast: ToastInput) => string>(() => "t1");
    const retry = vi.fn();
    failureToast(notify, "Toki could not save", new ApiError(500, "internal", "Server is down."), retry);
    const [toast] = notify.mock.calls[0];
    expect(toast).toMatchObject({ status: "error", title: "Toki could not save", description: "Server is down." });
    toast.action?.onClick({ id: "t1", ...toast } as AnimatedToast);
    expect(retry).toHaveBeenCalledOnce();
  });

  it("appends a suffix and omits Retry when there is nothing to retry", () => {
    const notify = vi.fn<(toast: ToastInput) => string>(() => "t1");
    failureToast(notify, "T", new ApiError(500, "internal", "Down."), undefined, "Back to saved order.");
    expect(notify.mock.calls[0][0]).toMatchObject({ description: "Down. Back to saved order.", action: undefined });
  });
});
