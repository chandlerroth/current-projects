import { readRepos } from "../lib/config.ts";
import { PROJECTS_DIR, type RepoInfo } from "../lib/paths.ts";
import {
  fetch,
  getCurrentBranch,
  getUpstream,
  getAheadBehind,
  getChangedFilesCount,
  isGitRepo,
  branchExists,
} from "../lib/git.ts";
import { blue, green, red, yellow, gray } from "../lib/colors.ts";
import { Spinner } from "../lib/spinner.ts";

interface RepoStatus {
  index: number;
  displayName: string;
  branch: string | null;
  ahead: number;
  behind: number;
  changes: number;
  installed: boolean;
}

async function getRepoStatus(repo: RepoInfo, index: number): Promise<RepoStatus> {
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
    // Try origin/main or origin/master
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

  // Get changed files count
  status.changes = await getChangedFilesCount(repo.fullPath);

  return status;
}

function formatStatus(status: RepoStatus, maxNameLen: number, maxBranchLen: number): string {
  const indexStr = `[${status.index}]`.padEnd(5);
  const nameStr = status.displayName.padEnd(maxNameLen);

  if (!status.installed) {
    return `${gray(indexStr)} ${gray(nameStr)} ${red("Not installed")}`;
  }

  const branchStr = status.branch || "unknown";
  const branchDisplay = `git:(${blue(branchStr)})`.padEnd(maxBranchLen + 12); // +12 for "git:()" and ANSI codes

  const statusParts: string[] = [];

  if (status.behind > 0) {
    statusParts.push(blue(`${status.behind}\u2193`));
  }
  if (status.ahead > 0) {
    statusParts.push(yellow(`${status.ahead}\u2191`));
  }
  if (status.changes > 0) {
    statusParts.push(red(`${status.changes} changes`));
  }
  if (statusParts.length === 0) {
    statusParts.push(green("\u2713 clean"));
  }

  return `${indexStr} ${nameStr} ${branchDisplay} [${statusParts.join(" ")}]`;
}

export async function runStatus(): Promise<void> {
  const repos = await readRepos();

  if (repos.length === 0) {
    console.log(yellow("No repositories configured. Run 'prj add <repo>' to add one."));
    return;
  }

  const spinner = new Spinner("Checking repositories...");
  spinner.start();

  // Check all repos concurrently
  const statusPromises = repos.map((repo, index) => getRepoStatus(repo, index + 1));
  const statuses = await Promise.all(statusPromises);

  spinner.stop();

  // Small delay to ensure stderr is flushed before stdout
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Calculate max lengths for alignment
  const maxNameLen = Math.max(...statuses.map((s) => s.displayName.length));
  const maxBranchLen = Math.max(...statuses.map((s) => (s.branch || "unknown").length));

  // Print all statuses
  for (const status of statuses) {
    console.log(formatStatus(status, maxNameLen, maxBranchLen));
  }

  // Check for unexpected directories
  await checkUnexpectedDirectories(repos);
}

async function checkUnexpectedDirectories(repos: RepoInfo[]): Promise<void> {
  const expectedPaths = new Set(repos.map((r) => r.fullPath));

  try {
    const proc = Bun.spawn(["find", PROJECTS_DIR, "-mindepth", "2", "-maxdepth", "2", "-type", "d"], {
      stdout: "pipe",
      stderr: "ignore",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const directories = output.trim().split("\n").filter(Boolean);
    const unexpected = directories.filter((dir) => !expectedPaths.has(dir));

    if (unexpected.length > 0) {
      console.log();
      console.log(yellow("Unexpected directories (not in config):"));
      for (const dir of unexpected) {
        const relativePath = dir.replace(PROJECTS_DIR + "/", "");
        console.log(gray(`  ${relativePath}`));
      }
    }
  } catch {
    // Silently ignore errors when checking for unexpected directories
  }
}
