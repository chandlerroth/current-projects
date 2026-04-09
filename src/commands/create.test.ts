import { test, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdtempSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const cloneCalls: Array<{ url: string; target: string }> = [];
let cloneShouldSucceed = true;
let createShouldThrow: Error | null = null;

mock.module("../lib/git.ts", () => ({
  cloneRepo: async (url: string, target: string) => {
    cloneCalls.push({ url, target });
    if (cloneShouldSucceed) mkdirSync(join(target, ".git"), { recursive: true });
    return cloneShouldSucceed;
  },
  isGitRepo: async () => false,
  executeGit: async () => ({ exitCode: 0 }),
  executeGitWithOutput: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
}));

mock.module("../lib/gh-api.ts", () => ({
  getCurrentUser: async () => "alice",
  createRepo: async (owner: string, name: string) => {
    if (createShouldThrow) throw createShouldThrow;
    return {
      nameWithOwner: `${owner}/${name}`,
      sshUrl: `git@github.com:${owner}/${name}.git`,
      htmlUrl: `https://github.com/${owner}/${name}`,
    };
  },
  _resetTokenCache: () => {},
}));

import { runCreate } from "./create.ts";

const origHome = process.env.HOME;
const origExit = process.exit;
const origLog = console.log;
let stdout = "";
let exitCode: number | null = null;

beforeEach(() => {
  cloneCalls.length = 0;
  cloneShouldSucceed = true;
  createShouldThrow = null;
  stdout = "";
  exitCode = null;
  const home = mkdtempSync(join(tmpdir(), "prj-create-"));
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

test("create --non-interactive --name=my-app uses current user as owner", async () => {
  await runCreate("my-app", true);
  const out = JSON.parse(stdout);
  expect(out.success).toBe(true);
  expect(out.nameWithOwner).toBe("alice/my-app");
  expect(out.sshUrl).toBe("git@github.com:alice/my-app.git");
  expect(cloneCalls).toHaveLength(1);
});

test("create --non-interactive --name=org/repo uses explicit owner", async () => {
  await runCreate("acme/widget", true);
  const out = JSON.parse(stdout);
  expect(out.success).toBe(true);
  expect(out.nameWithOwner).toBe("acme/widget");
});

test("create --non-interactive without a name fails with JSON error", async () => {
  await expect(runCreate(undefined, true)).rejects.toThrow("__exit:1");
  expect(exitCode).toBe(1);
  expect(JSON.parse(stdout).success).toBe(false);
});

test("create --non-interactive surfaces createRepo failure as JSON error", async () => {
  createShouldThrow = new Error("name already exists on this account");
  await expect(runCreate("dup", true)).rejects.toThrow("__exit:1");
  const out = JSON.parse(stdout);
  expect(out.success).toBe(false);
  expect(out.error).toContain("name already exists");
});

test("create --non-interactive rolls back when local clone fails", async () => {
  cloneShouldSucceed = false;
  await expect(runCreate("acme/widget", true)).rejects.toThrow("__exit:1");
  const out = JSON.parse(stdout);
  expect(out.success).toBe(false);
  expect(out.error).toContain("Failed to clone");
  // Rollback metadata is included so agents can detect what happened.
  expect(out).toHaveProperty("rollback");
});
