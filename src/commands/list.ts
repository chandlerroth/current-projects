import { scanProjects } from "../lib/config.ts";
import { select } from "../lib/prompt.ts";
import { yellow } from "../lib/colors.ts";
import { Spinner } from "../lib/spinner.ts";
import { getRepoStatus, formatStatusHint } from "../lib/status.ts";

export async function runList(): Promise<void> {
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
