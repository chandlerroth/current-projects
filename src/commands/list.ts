import { scanProjects } from "../lib/config.ts";
import { select } from "../lib/prompt.ts";
import { blue, green, red, yellow, gray } from "../lib/colors.ts";
import { Spinner } from "../lib/spinner.ts";
import { getRepoStatus, formatStatusHint, type RepoStatus } from "../lib/status.ts";

function formatStatusLine(status: RepoStatus, maxNameLen: number, maxBranchLen: number): string {
  const indexStr = `[${status.index}]`.padEnd(5);
  const nameStr = status.displayName.padEnd(maxNameLen);

  if (!status.installed) {
    return `${gray(indexStr)} ${gray(nameStr)} ${red("Not installed")}`;
  }

  const branchStr = status.branch || "unknown";
  const branchDisplay = `git:(${blue(branchStr)})`.padEnd(maxBranchLen + 12);

  const statusParts: string[] = [];

  if (status.behind > 0) statusParts.push(blue(`${status.behind}\u2193`));
  if (status.ahead > 0) statusParts.push(yellow(`${status.ahead}\u2191`));
  if (status.changes > 0) statusParts.push(red(`${status.changes} changes`));
  if (statusParts.length === 0) statusParts.push(green("\u2713 clean"));

  return `${indexStr} ${nameStr} ${branchDisplay} [${statusParts.join(" ")}]`;
}

export async function runList(nonInteractive = false): Promise<void> {
  const repos = scanProjects();

  if (repos.length === 0) {
    process.stderr.write(yellow("No projects found. Run 'prj add <repo>' to add one.\n"));
    return;
  }

  const spinner = new Spinner("Checking repositories...");
  spinner.start();

  const statuses = await Promise.all(
    repos.map((repo, i) => getRepoStatus(repo, i + 1))
  );

  spinner.stop();

  if (nonInteractive) {
    // Small delay to ensure stderr is flushed before stdout
    await new Promise((resolve) => setTimeout(resolve, 10));

    const maxNameLen = Math.max(...statuses.map((s) => s.displayName.length));
    const maxBranchLen = Math.max(...statuses.map((s) => (s.branch || "unknown").length));

    for (const status of statuses) {
      console.log(formatStatusLine(status, maxNameLen, maxBranchLen));
    }
    return;
  }

  const maxNameLen = Math.max(...repos.map((r) => r.displayName.length));

  const options = repos.map((repo, i) => ({
    label: repo.displayName.padEnd(maxNameLen),
    value: repo.fullPath,
    hint: formatStatusHint(statuses[i]),
  }));

  const selected = await select(options);

  if (selected) {
    console.log(selected);
  }
}
