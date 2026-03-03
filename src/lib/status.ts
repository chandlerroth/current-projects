import { type RepoInfo } from "./paths.ts";
import {
  fetch,
  getCurrentBranch,
  getUpstream,
  getAheadBehind,
  getChangedFilesCount,
  isGitRepo,
  branchExists,
} from "./git.ts";
import { blue, green, red, yellow } from "./colors.ts";

export interface RepoStatus {
  index: number;
  displayName: string;
  branch: string | null;
  ahead: number;
  behind: number;
  changes: number;
  installed: boolean;
}

export async function getRepoStatus(repo: RepoInfo, index: number): Promise<RepoStatus> {
  const status: RepoStatus = {
    index,
    displayName: repo.displayName,
    branch: null,
    ahead: 0,
    behind: 0,
    changes: 0,
    installed: false,
  };

  if (!(await isGitRepo(repo.fullPath))) {
    return status;
  }

  status.installed = true;

  // Fetch in background (don't wait)
  fetch(repo.fullPath);

  // Get current branch
  status.branch = await getCurrentBranch(repo.fullPath);

  // Get upstream or compare against main/master
  let compareBranch = await getUpstream(repo.fullPath);
  if (!compareBranch) {
    if (await branchExists(repo.fullPath, "origin/main")) {
      compareBranch = "origin/main";
    } else if (await branchExists(repo.fullPath, "origin/master")) {
      compareBranch = "origin/master";
    }
  }

  if (compareBranch) {
    const { ahead, behind } = await getAheadBehind(repo.fullPath, compareBranch);
    status.ahead = ahead;
    status.behind = behind;
  }

  status.changes = await getChangedFilesCount(repo.fullPath);

  return status;
}

/**
 * Format status as a short hint string for use in the list picker.
 * e.g. "git:(main) [✓ clean]" or "git:(main) [2↑ 3 changes]"
 */
export function formatStatusHint(status: RepoStatus): string {
  if (!status.installed) {
    return red("Not installed");
  }

  const branchStr = status.branch || "unknown";
  const parts: string[] = [];

  if (status.behind > 0) parts.push(blue(`${status.behind}\u2193`));
  if (status.ahead > 0) parts.push(yellow(`${status.ahead}\u2191`));
  if (status.changes > 0) parts.push(red(`${status.changes} changes`));
  if (parts.length === 0) parts.push(green("\u2713 clean"));

  return `git:(${blue(branchStr)}) [${parts.join(" ")}]`;
}
