import { test, expect } from "bun:test";
import { isShorthand, expandRepoUrl, parseRepoUrl, ensureInsideProjects, projectsDir } from "./paths.ts";
import { join } from "path";

test("isShorthand recognizes user/repo", () => {
  expect(isShorthand("user/repo")).toBe(true);
  expect(isShorthand("Some-User/some.repo")).toBe(true);
  expect(isShorthand("user")).toBe(false);
  expect(isShorthand("https://github.com/u/r")).toBe(false);
  expect(isShorthand("git@github.com:u/r.git")).toBe(false);
  expect(isShorthand("a/b/c")).toBe(false);
});

test("expandRepoUrl expands shorthand only", () => {
  expect(expandRepoUrl("user/repo")).toBe("https://github.com/user/repo.git");
  const url = "git@github.com:u/r.git";
  expect(expandRepoUrl(url)).toBe(url);
});

test("parseRepoUrl handles shorthand", () => {
  const r = parseRepoUrl("User/Repo");
  expect(r).not.toBeNull();
  expect(r!.username).toBe("user");
  expect(r!.repoName).toBe("repo");
  expect(r!.displayName).toBe("user/repo");
});

test("parseRepoUrl handles SSH", () => {
  const r = parseRepoUrl("git@github.com:Foo/Bar.git");
  expect(r).not.toBeNull();
  expect(r!.username).toBe("foo");
  expect(r!.repoName).toBe("bar");
});

test("parseRepoUrl handles HTTPS with and without .git", () => {
  const a = parseRepoUrl("https://github.com/foo/bar.git");
  const b = parseRepoUrl("https://github.com/foo/bar");
  expect(a!.repoName).toBe("bar");
  expect(b!.repoName).toBe("bar");
});

test("parseRepoUrl returns null for garbage", () => {
  expect(parseRepoUrl("not a url")).toBeNull();
  expect(parseRepoUrl("git@bad")).toBeNull();
});

test("isShorthand rejects traversal and dash-prefixed segments", () => {
  expect(isShorthand("foo/..")).toBe(false);
  expect(isShorthand("../foo")).toBe(false);
  expect(isShorthand("./foo")).toBe(false);
  expect(isShorthand("foo/.")).toBe(false);
  expect(isShorthand("-rf/foo")).toBe(false);
  expect(isShorthand("foo/-rf")).toBe(false);
});

test("parseRepoUrl rejects traversal in every format", () => {
  expect(parseRepoUrl("foo/..")).toBeNull();
  expect(parseRepoUrl("../etc")).toBeNull();
  expect(parseRepoUrl("git@github.com:foo/..")).toBeNull();
  expect(parseRepoUrl("git@github.com:../foo")).toBeNull();
  expect(parseRepoUrl("https://github.com/foo/..")).toBeNull();
  // Note: `new URL()` already collapses leading `..` segments, so something
  // like `https://github.com/../etc/passwd` resolves to `etc/passwd` and is
  // safely contained inside `~/Projects/etc/passwd`. No test for that case.
});

test("ensureInsideProjects allows children, rejects siblings/parents", () => {
  const root = projectsDir();
  expect(() => ensureInsideProjects(join(root, "alice", "one"))).not.toThrow();
  expect(() => ensureInsideProjects(join(root, "alice"))).not.toThrow();
  expect(() => ensureInsideProjects(root)).toThrow();
  expect(() => ensureInsideProjects(join(root, ".."))).toThrow();
  expect(() => ensureInsideProjects(join(root, "..", "etc"))).toThrow();
  expect(() => ensureInsideProjects("/etc/passwd")).toThrow();
});
