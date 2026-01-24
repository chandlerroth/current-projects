import { readRepos, readRepoUrls, removeRepoFromConfig } from "../lib/config.ts";
import { getChangedFilesCount, getAheadBehind, getUpstream, getStashCount, isGitRepo } from "../lib/git.ts";
import { PROJECTS_DIR } from "../lib/paths.ts";
import { red, yellow, gray } from "../lib/colors.ts";
import { join } from "path";

export async function runDelete(arg: string | undefined): Promise<void> {
  if (!arg) {
    console.error(red("Usage: prj rm <index|.>"));
    process.exit(1);
  }

  const repos = await readRepos();
  const repoUrls = await readRepoUrls();

  let index: number;

  if (arg === ".") {
    // Find index by current directory
    const cwd = process.cwd();
    index = repos.findIndex((r) => r.fullPath === cwd);
    if (index === -1) {
      console.error(red("Current directory is not a tracked project."));
      process.exit(1);
    }
    index += 1; // Convert to 1-based
  } else {
    index = parseInt(arg, 10);
    if (isNaN(index) || index < 1) {
      console.error(red("Argument must be a positive number or '.'"));
      process.exit(1);
    }
    if (index > repos.length) {
      console.error(red(`Index out of range. You have ${repos.length} projects.`));
      process.exit(1);
    }
  }

  const repo = repos[index - 1];
  const repoUrl = repoUrls[index - 1];

  console.error(`Checking ${repo.displayName}...`);

  // Check if directory exists and is a git repo
  const isRepo = await isGitRepo(repo.fullPath);

  const issues: string[] = [];

  if (isRepo) {
    // Run safety checks
    const changedCount = await getChangedFilesCount(repo.fullPath);
    if (changedCount > 0) {
      issues.push(`${changedCount} uncommitted change${changedCount === 1 ? "" : "s"}`);
    }

    const upstream = await getUpstream(repo.fullPath);
    if (upstream) {
      const { ahead } = await getAheadBehind(repo.fullPath, upstream);
      if (ahead > 0) {
        issues.push(`${ahead} unpushed commit${ahead === 1 ? "" : "s"}`);
      }
    }

    const stashCount = await getStashCount(repo.fullPath);
    if (stashCount > 0) {
      issues.push(`${stashCount} stash${stashCount === 1 ? "" : "es"}`);
    }
  }

  // Show warnings if there are issues (to stderr so shell integration doesn't capture)
  if (issues.length > 0) {
    console.error();
    console.error(yellow("Warning: This repository has unsaved work:"));
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
  }

  // Always prompt for confirmation (to stderr)
  console.error();
  process.stderr.write(`Remove ${repo.displayName}? [y/N]: `);

  const confirmed = await waitForConfirmation();
  if (!confirmed) {
    console.error(gray("Cancelled."));
    return;
  }

  // Remove from config
  await removeRepoFromConfig(repoUrl);

  // Delete directory if it exists
  if (isRepo) {
    const proc = Bun.spawn(["rm", "-rf", repo.fullPath]);
    await proc.exited;
  }

  // Output parent directory (org-level) to stdout for shell integration to cd into
  const parentDir = join(PROJECTS_DIR, repo.username);
  console.log(parentDir);
}

async function waitForConfirmation(): Promise<boolean> {
  const reader = Bun.stdin.stream().getReader();
  const { value } = await reader.read();
  reader.releaseLock();

  if (!value) return false;
  const input = new TextDecoder().decode(value).trim().toLowerCase();
  return input === "y" || input === "yes";
}
