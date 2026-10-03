import { beforeEach, describe, expect, it } from "vitest";
import { restoreMode, setMode } from "@/lib/mode";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.mode;
});

describe("money/time mode", () => {
  it("sets the root data attribute and saves the choice", () => {
    setMode("time");
    expect(document.documentElement.dataset.mode).toBe("time");
    expect(localStorage.getItem("toki.mode")).toBe("time");
    setMode("money");
    expect(document.documentElement.dataset.mode).toBeUndefined();
    expect(localStorage.getItem("toki.mode")).toBe("money");
  });

  it("restores the saved choice without writing it again", () => {
    localStorage.setItem("toki.mode", "time");
    restoreMode();
    expect(document.documentElement.dataset.mode).toBe("time");
    localStorage.setItem("toki.mode", "garbage");
    restoreMode();
    expect(document.documentElement.dataset.mode).toBeUndefined();
    expect(localStorage.getItem("toki.mode")).toBe("garbage");
  });
});
