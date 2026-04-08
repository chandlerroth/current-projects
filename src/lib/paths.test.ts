import { test, expect } from "bun:test";
import { isShorthand, expandRepoUrl, parseRepoUrl } from "./paths.ts";

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
