import { describe, expect, it } from "vitest";
import { searchCommands } from "@/lib/command-search";

const commands = [
  { label: "Add item", group: "Wishlist", keywords: ["paste link", "save product"] },
  { label: "All items", group: "Navigate" },
  { label: "Bought", group: "Navigate", keywords: ["purchased"] },
  { label: "Email alerts", group: "Settings", keywords: ["notifications"] },
  { label: "Hours of work", group: "Settings", keywords: ["salary", "income"] },
  { label: "Toggle theme", group: "Appearance", keywords: ["dark mode"] },
];
const labels = (q: string) => searchCommands(commands, q).map((c) => c.label);

describe("searchCommands", () => {
  it("returns everything for an empty query", () => {
    expect(searchCommands(commands, "   ")).toBe(commands);
  });

  it("puts exact and prefix label matches first", () => {
    expect(labels("bought")[0]).toBe("Bought");
    expect(labels("add")[0]).toBe("Add item");
    // Label prefixes beat a substring inside a keyword ("s-al-ary").
    expect(labels("al")).toEqual(["All items", "Email alerts", "Hours of work"]);
  });

  it("matches groups and keywords", () => {
    expect(labels("salary")).toEqual(["Hours of work"]);
    expect(labels("dark")).toEqual(["Toggle theme"]);
    expect(labels("settings")).toEqual(["Email alerts", "Hours of work"]);
  });

  it("needs every word to match", () => {
    expect(labels("email notifications")).toEqual(["Email alerts"]);
    expect(labels("email salary")).toEqual([]);
  });

  it("ignores case, accents and punctuation", () => {
    expect(labels("ÉMAIL-alerts!")).toEqual(["Email alerts"]);
  });

  it("allows small fuzzy gaps but keeps short queries precise", () => {
    expect(labels("bght")).toEqual(["Bought"]);
    expect(labels("zz")).toEqual([]);
  });
});
