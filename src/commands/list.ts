import { readRepos } from "../lib/config.ts";
import { select } from "../lib/prompt.ts";
import { yellow } from "../lib/colors.ts";

export async function runList(): Promise<void> {
  const repos = await readRepos();

  if (repos.length === 0) {
    // Output to stderr since stdout is for the selected path
    process.stderr.write(yellow("No repositories configured. Run 'prj add <repo>' to add one.\n"));
    return;
  }

  const options = repos.map((repo) => ({
    label: repo.displayName,
    value: repo.fullPath,
  }));

  const selected = await select(options);

  if (selected) {
    // Output selected path to stdout (for shell integration)
    console.log(selected);
  }
}
