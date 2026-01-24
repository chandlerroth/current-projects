import { addRepoToConfig, repoExistsInConfig } from "../lib/config.ts";
import { parseRepoUrl } from "../lib/paths.ts";
import { cloneRepo, isGitRepo } from "../lib/git.ts";
import { green, red, yellow } from "../lib/colors.ts";

export async function runAdd(repoUrl: string | undefined): Promise<void> {
  if (!repoUrl) {
    console.error(red("Usage: prj add <repo-url>"));
    console.error("Example: prj add git@github.com:username/repo.git");
    process.exit(1);
  }

  // Parse the repo URL
  const repoInfo = parseRepoUrl(repoUrl);
  if (!repoInfo) {
    console.error(red("Invalid repository URL format"));
    console.error("Supported formats:");
    console.error("  git@github.com:username/repo.git");
    console.error("  https://github.com/username/repo.git");
    process.exit(1);
  }

  // Check if already in config
  if (await repoExistsInConfig(repoUrl)) {
    console.error(red(`Repository ${repoInfo.displayName} is already in config`));
    process.exit(1);
  }

  // Add to config
  await addRepoToConfig(repoUrl);
  console.log(green(`Added ${repoInfo.displayName} to config`));

  // Clone if not already cloned
  if (await isGitRepo(repoInfo.fullPath)) {
    console.log(yellow(`${repoInfo.displayName} already cloned at ${repoInfo.fullPath}`));
  } else {
    console.log(`Cloning ${repoInfo.displayName}...`);
    const success = await cloneRepo(repoUrl, repoInfo.fullPath);
    if (success) {
      console.log(green(`Cloned to ${repoInfo.fullPath}`));
    } else {
      console.error(red(`Failed to clone ${repoInfo.displayName}`));
      process.exit(1);
    }
  }
}
