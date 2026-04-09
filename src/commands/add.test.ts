import { test, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdtempSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Mock git ops so add doesn't shell out to real git/network.
const cloneCalls: Array<{ url: string; target: string }> = [];
let cloneShouldSucceed = true;
let existingRepos = new Set<string>();

mock.module("../lib/git.ts", () => ({
  cloneRepo: async (url: string, target: string) => {
    cloneCalls.push({ url, target });
    if (cloneShouldSucceed) {
      mkdirSync(join(target, ".git"), { recursive: true });
    }
    return cloneShouldSucceed;
  },
  isGitRepo: async (path: string) => existingRepos.has(path),
}));

import { runAdd } from "./add.ts";

const origHome = process.env.HOME;
const origExit = process.exit;
const origLog = console.log;
let stdout = "";
let exitCode: number | null = null;

beforeEach(() => {
  cloneCalls.length = 0;
  cloneShouldSucceed = true;
  existingRepos = new Set();
  stdout = "";
  exitCode = null;
  const home = mkdtempSync(join(tmpdir(), "prj-add-"));
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

test("add --non-interactive clones a shorthand repo and emits JSON", async () => {
  await runAdd("alice/repo", true);
  const out = JSON.parse(stdout);
  expect(out.success).toBe(true);
  expect(out.cloned).toBe(true);
  expect(out.displayName).toBe("alice/repo");
  expect(cloneCalls).toHaveLength(1);
  expect(cloneCalls[0].url).toBe("https://github.com/alice/repo.git");
});

test("add --non-interactive without a repo arg fails with JSON error", async () => {
  await expect(runAdd(undefined, true)).rejects.toThrow("__exit:1");
  expect(exitCode).toBe(1);
  const out = JSON.parse(stdout);
  expect(out.success).toBe(false);
  expect(out.error).toMatch(/Missing repo/);
});

test("add --non-interactive rejects an invalid URL with JSON error", async () => {
  await expect(runAdd("not a url", true)).rejects.toThrow("__exit:1");
  expect(JSON.parse(stdout).success).toBe(false);
});

test("add --non-interactive returns cloned:false when repo already exists locally", async () => {
  const home = process.env.HOME!;
  const target = join(home, "Projects", "alice", "repo");
  existingRepos.add(target);

  await runAdd("alice/repo", true);
  const out = JSON.parse(stdout);
  expect(out.success).toBe(true);
  expect(out.cloned).toBe(false);
  expect(cloneCalls).toHaveLength(0);
});
