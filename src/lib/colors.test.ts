import { test, expect } from "bun:test";
import { red, green, yellow, blue, cyan, gray } from "./colors.ts";

test("color wrappers wrap with reset", () => {
  for (const fn of [red, green, yellow, blue, cyan, gray]) {
    const out = fn("hi");
    expect(out).toContain("hi");
    expect(out).toMatch(/\x1b\[\d+m/);
    expect(out).toEndWith("\x1b[0m");
  }
});
