// @vitest-environment node
// The proxy runs on the server; happy-dom would strip the forbidden "cookie" request header.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

describe("proxy (auth gate for /app)", () => {
  it("redirects to /login without a session cookie", () => {
    const res = proxy(new NextRequest("https://toki.test/app/settings"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://toki.test/login");
  });

  it("lets requests with a session cookie through", () => {
    const req = new NextRequest("https://toki.test/app", { headers: { cookie: "toki_session=abc" } });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("only guards /app", () => {
    expect(config.matcher).toBe("/app/:path*");
  });
});
