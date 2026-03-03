import { scanProjects } from "../lib/config.ts";
import { blue, green, red, yellow, gray } from "../lib/colors.ts";
import { Spinner } from "../lib/spinner.ts";
import { getRepoStatus, type RepoStatus } from "../lib/status.ts";

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
  const repos = scanProjects();

  if (repos.length === 0) {
    console.log(yellow("No projects found. Run 'prj add <repo>' to add one."));
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
}
