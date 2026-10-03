import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
function call(n = 0): [string, RequestInit] {
  const c = fetchMock.mock.calls[n];
  if (!c) throw new Error(`fetch call ${n} was not made`);
  return c as [string, RequestInit];
}

describe("web api client", () => {
  it("sends same-origin requests with cookies and JSON", async () => {
    fetchMock.mockResolvedValue(json(201, { id: "l1" }));
    expect(await api.createList({ name: "Gifts" })).toEqual({ id: "l1" });
    const [url, init] = call();
    expect(url).toBe("/api/lists");
    expect(init).toMatchObject({ method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(init.body as string)).toEqual({ name: "Gifts" });
  });

  it("sends an empty JSON object for body-less POSTs", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await api.logout()).toBeUndefined();
    expect(call()[1].body).toBe("{}");
  });

  it("builds query strings and paths", async () => {
    fetchMock.mockResolvedValue(json(200, { items: [] }));
    await api.items("l1");
    await api.items("l1", "all");
    await api.history("i1", 30);
    expect(call(0)[0]).toBe("/api/lists/l1/items?status=wanted");
    expect(call(1)[0]).toBe("/api/lists/l1/items?status=all");
    expect(call(2)[0]).toBe("/api/items/i1/history?days=30");
    expect(call(2)[1].method).toBe("GET");
    expect(call(2)[1].body).toBeUndefined();
  });

  it("uses PATCH and DELETE", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { id: "i1" })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await api.updateItem("i1", { note: "x", target_price_minor: null });
    await api.deleteItem("i1");
    expect(call(0)[1].method).toBe("PATCH");
    expect(JSON.parse(call(0)[1].body as string)).toEqual({ note: "x", target_price_minor: null });
    expect(call(1)).toMatchObject(["/api/items/i1", { method: "DELETE" }]);
  });

  it("throws ApiError with the contract code and message", async () => {
    fetchMock.mockResolvedValue(json(409, { error: { code: "email_taken", message: "Taken." } }));
    const err = await api.signup({ email: "a@b.in", password: "password123", name: "A" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: "email_taken", message: "Taken." });
  });

  it("falls back to a generic error when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    await expect(api.me()).rejects.toMatchObject({ status: 502, code: "internal" });
  });

  it("reports network failures as status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.stats()).rejects.toMatchObject({ status: 0, code: "internal" });
  });
});
