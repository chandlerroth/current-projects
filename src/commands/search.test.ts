import { test, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdtempSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let mockResults: Array<{ nameWithOwner: string; description: string | null }> = [];
let searchShouldThrow: Error | null = null;

mock.module("../lib/gh-api.ts", () => ({
  fetchGhRepos: async () => mockResults,
  searchRepos: async () => {
    if (searchShouldThrow) throw searchShouldThrow;
    return mockResults;
  },
  _resetTokenCache: () => {},
}));

import { runSearch } from "./search.ts";

const origHome = process.env.HOME;
const origExit = process.exit;
const origLog = console.log;
let stdout = "";
let exitCode: number | null = null;

beforeEach(() => {
  mockResults = [];
  searchShouldThrow = null;
  stdout = "";
  exitCode = null;
  const home = mkdtempSync(join(tmpdir(), "prj-search-"));
  process.env.HOME = home;
  mkdirSync(join(home, "Projects"), { recursive: true });
  // @ts-expect-error stub
  process.exit = (code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`__exit:${code}`);
  };
  console.log = (...args: unknown[]) => {
    stdout += args.map((a) => (typeof a === "string" ? a : String(a))).join(" ") + "\n";
  };
});

afterEach(() => {
  console.log = origLog;
  process.exit = origExit;
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
});

test("search --non-interactive emits JSON results with cloned flag", async () => {
  // Pre-clone alice/one so we can verify the cloned flag is set.
  const home = process.env.HOME!;
  mkdirSync(join(home, "Projects", "alice", "one"), { recursive: true });

  mockResults = [
    { nameWithOwner: "alice/one", description: "first" },
    { nameWithOwner: "bob/two", description: null },
  ];

  await runSearch("foo", true);
  const out = JSON.parse(stdout);
  expect(out).toHaveLength(2);
  const aliceEntry = out.find((r: { nameWithOwner: string }) => r.nameWithOwner === "alice/one");
  const bobEntry = out.find((r: { nameWithOwner: string }) => r.nameWithOwner === "bob/two");
  expect(aliceEntry.cloned).toBe(true);
  expect(bobEntry.cloned).toBe(false);
});

test("search --non-interactive surfaces fetch errors via process.exit", async () => {
  searchShouldThrow = new Error("rate limited");
  await expect(runSearch("anything", true)).rejects.toThrow("__exit:1");
  expect(exitCode).toBe(1);
});
