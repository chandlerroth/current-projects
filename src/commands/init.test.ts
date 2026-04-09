import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runInit } from "./init.ts";

const origHome = process.env.HOME;
const origLog = console.log;
let stdout = "";

beforeEach(() => {
  stdout = "";
  console.log = (...args: unknown[]) => {
    stdout += args.map((a) => (typeof a === "string" ? a : String(a))).join(" ") + "\n";
  };
});

afterEach(() => {
  console.log = origLog;
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
});

test("init --non-interactive creates ~/Projects when missing", async () => {
  const home = mkdtempSync(join(tmpdir(), "prj-init-"));
  process.env.HOME = home;

  await runInit(true);

  const out = JSON.parse(stdout);
  expect(out.success).toBe(true);
  expect(out.created).toBe(true);
  expect(out.path).toBe(join(home, "Projects"));
  expect(existsSync(join(home, "Projects"))).toBe(true);
});

test("init --non-interactive is idempotent when ~/Projects exists", async () => {
  const home = mkdtempSync(join(tmpdir(), "prj-init-"));
  process.env.HOME = home;
  mkdirSync(join(home, "Projects"));

  await runInit(true);

  const out = JSON.parse(stdout);
  expect(out.success).toBe(true);
  expect(out.created).toBe(false);
});
