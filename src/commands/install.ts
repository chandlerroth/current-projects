import { readRepoUrls } from "../lib/config.ts";
import { parseRepoUrl } from "../lib/paths.ts";
import { cloneRepo, isGitRepo } from "../lib/git.ts";
import { green, red, yellow } from "../lib/colors.ts";

export async function runInstall(): Promise<void> {
  const repoUrls = await readRepoUrls();

  if (repoUrls.length === 0) {
    console.log(yellow("No repositories in config. Add some with 'prj add <repo-url>'"));
    return;
  }

  console.log(`Installing ${repoUrls.length} repositories...\n`);

  let installed = 0;
  let skipped = 0;
  let failed = 0;

  for (const url of repoUrls) {
    const repoInfo = parseRepoUrl(url);
    if (!repoInfo) {
      console.error(red(`Invalid URL: ${url}`));
      failed++;
      continue;
    }

    if (await isGitRepo(repoInfo.fullPath)) {
      console.log(yellow(`[skip] ${repoInfo.displayName} already exists`));
      skipped++;
      continue;
    }

    console.log(`Cloning ${repoInfo.displayName}...`);
    const success = await cloneRepo(url, repoInfo.fullPath);
    if (success) {
      console.log(green(`[done] ${repoInfo.displayName}`));
      installed++;
    } else {
      console.error(red(`[fail] ${repoInfo.displayName}`));
      failed++;
    }
  }

  console.log();
  console.log(`Installed: ${installed}, Skipped: ${skipped}, Failed: ${failed}`);
}
