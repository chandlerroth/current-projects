import { homedir } from "os";
import { join } from "path";

export const PROJECTS_DIR = join(homedir(), "Projects");
export const CONFIG_FILE = join(PROJECTS_DIR, ".current-projects");

export interface RepoInfo {
  username: string;
  repoName: string;
  fullPath: string;
  displayName: string;
}

/**
 * Parse a git repo URL and return repo info
 * Supports:
 * - git@github.com:username/repo.git
 * - https://github.com/username/repo.git
 * - https://github.com/username/repo
 */
export function parseRepoUrl(url: string): RepoInfo | null {
  let username: string;
  let repoName: string;

  // SSH format: git@github.com:username/repo.git
  if (url.startsWith("git@")) {
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
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    username = parts[0].toLowerCase();
    repoName = parts[1].replace(/\.git$/, "").toLowerCase();
  } else {
    return null;
  }

  const fullPath = join(PROJECTS_DIR, username, repoName);
  const displayName = `${username}/${repoName}`;

  return { username, repoName, fullPath, displayName };
}

/**
 * Get display name from a repo path
 */
export function getDisplayNameFromPath(repoPath: string): string {
  const relative = repoPath.replace(PROJECTS_DIR + "/", "");
  const parts = relative.split("/");
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return relative;
}
