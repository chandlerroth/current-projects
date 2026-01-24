import { readRepos } from "../lib/config.ts";
import { red } from "../lib/colors.ts";

export async function runCd(indexStr: string | undefined): Promise<void> {
  if (!indexStr) {
    console.error(red("Usage: prj cd <index>"));
    process.exit(1);
  }

  const index = parseInt(indexStr, 10);
  if (isNaN(index) || index < 1) {
    console.error(red("Index must be a positive number"));
    process.exit(1);
  }

  const repos = await readRepos();
  if (index > repos.length) {
    console.error(red(`Index out of range. You have ${repos.length} projects.`));
    process.exit(1);
  }

  // Output path to stdout (1-indexed)
  const repo = repos[index - 1];
  console.log(repo.fullPath);
}
