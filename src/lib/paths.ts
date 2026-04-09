import { homedir } from "os";
import { join, resolve, sep } from "path";

/**
 * Resolve `~/Projects` lazily. Reading at call time (rather than caching at
 * module load) lets tests override `$HOME` and exercise commands directly.
 */
export function projectsDir(): string {
  // Prefer $HOME so tests can point a temp dir at the resolver. `os.homedir()`
  // is cached on macOS and won't reflect runtime env changes.
  return join(process.env.HOME || homedir(), "Projects");
}

export interface RepoInfo {
  username: string;
  repoName: string;
  fullPath: string;
  displayName: string;
}

/**
 * Reject path segments that could escape `~/Projects/<org>/<repo>`. We
 * disallow `.`, `..`, empty, leading dash, and any segment containing a
 * separator. Used by `isShorthand` and the SSH/HTTPS branches of
 * `parseRepoUrl` so a malicious shorthand can never produce a path that
 * resolves outside `projectsDir()`.
 */
function isSafeSegment(s: string): boolean {
  if (!s) return false;
  if (s === "." || s === "..") return false;
  if (s.startsWith("-")) return false;
  if (s.includes("/") || s.includes("\\") || s.includes("\0")) return false;
  return true;
}

/**
 * Assert that `target` is strictly inside `projectsDir()`. Throws if it isn't.
 * Call this before any destructive fs op (`rmSync`, `rm -rf`, `renameSync`)
 * whose target is derived from user input — even indirectly via `parseRepoUrl`.
 */
export function ensureInsideProjects(target: string): void {
  const root = resolve(projectsDir()) + sep;
  const resolved = resolve(target);
  if (resolved + sep === root || !(resolved + sep).startsWith(root)) {
    throw new Error(`Refusing destructive op outside ~/Projects: ${target}`);
  }
}

/**
 * Check if a string is a shorthand GitHub pattern (e.g., "username/repo").
 * Rejects traversal segments (`.`, `..`), leading-dash segments, and anything
 * with a separator inside a segment.
 */
export function isShorthand(input: string): boolean {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(input)) return false;
  const [a, b] = input.split("/");
  return isSafeSegment(a) && isSafeSegment(b);
}

/**
 * Expand a shorthand pattern to a full HTTPS URL
 */
export function expandRepoUrl(input: string): string {
  if (isShorthand(input)) {
    return `https://github.com/${input}.git`;
  }
  return input;
}

/**
 * Parse a git repo URL and return repo info
 * Supports:
 * - username/repo (shorthand, expands to GitHub HTTPS)
 * - git@github.com:username/repo.git
 * - https://github.com/username/repo.git
 * - https://github.com/username/repo
 */
export function parseRepoUrl(url: string): RepoInfo | null {
  let username: string;
  let repoName: string;

  // Shorthand format: username/repo
  if (isShorthand(url)) {
    const parts = url.split("/");
    username = parts[0].toLowerCase();
    repoName = parts[1].replace(/\.git$/, "").toLowerCase();
  }
  // SSH format: git@github.com:username/repo.git
  else if (url.startsWith("git@")) {
    const colonIndex = url.indexOf(":");
    if (colonIndex === -1) return null;
    const path = url.slice(colonIndex + 1);
    const parts = path.split("/");
    if (parts.length !== 2) return null;
    username = parts[0].toLowerCase();
    repoName = parts[1].replace(/\.git$/, "").toLowerCase();
  }
  // HTTPS format: https://github.com/username/repo.git
  else if (url.startsWith("https://") || url.startsWith("http://")) {
    let urlObj: URL;
    try { urlObj = new URL(url); } catch { return null; }
    const parts = urlObj.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    username = parts[0].toLowerCase();
    repoName = parts[1].replace(/\.git$/, "").toLowerCase();
  } else {
    return null;
  }

  // Defense in depth: even after the format-specific parse, reject any
  // segment that could escape `~/Projects/<org>/<repo>`.
  if (!isSafeSegment(username) || !isSafeSegment(repoName)) return null;

  const fullPath = join(projectsDir(), username, repoName);
  // Belt and braces: verify the resolved path is strictly inside projectsDir.
  try {
    ensureInsideProjects(fullPath);
  } catch {
    return null;
  }
  const displayName = `${username}/${repoName}`;

  return { username, repoName, fullPath, displayName };
}

/**
 * Get display name from a repo path
 */
export function getDisplayNameFromPath(repoPath: string): string {
  const relative = repoPath.replace(projectsDir() + "/", "");
  const parts = relative.split("/");
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return relative;
}
