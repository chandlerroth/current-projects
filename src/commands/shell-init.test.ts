import { test, expect } from "bun:test";
import { runShellInit } from "./shell-init.ts";

test("shell-init prints a POSIX function that auto-cds", async () => {
  let captured = "";
  const orig = process.stdout.write.bind(process.stdout);
  // @ts-expect-error overwrite for capture
  process.stdout.write = (chunk: string | Uint8Array) => {
    captured += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  };
  try {
    await runShellInit();
  } finally {
    process.stdout.write = orig;
  }
  expect(captured).toContain("prj() {");
  expect(captured).toContain('command prj "$@"');
  expect(captured).toContain("cd \"$out\"");
  expect(captured).toContain("local out");
});
