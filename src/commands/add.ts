import { expandRepoUrl, parseRepoUrl } from "../lib/paths.ts";
import { cloneRepo, isGitRepo } from "../lib/git.ts";
import { green, red, yellow } from "../lib/colors.ts";

export async function runAdd(repoUrl: string | undefined): Promise<void> {
  if (!repoUrl) {
    console.error(red("Usage: prj add <repo>"));
    console.error("Examples:");
    console.error("  prj add username/repo");
    console.error("  prj add git@github.com:username/repo.git");
    console.error("  prj add https://github.com/username/repo.git");
    process.exit(1);
  }

  // Expand shorthand (e.g., "username/repo" -> full HTTPS URL)
  const fullUrl = expandRepoUrl(repoUrl);

  // Parse the repo URL
  const repoInfo = parseRepoUrl(fullUrl);
  if (!repoInfo) {
    console.error(red("Invalid repository URL format"));
    console.error("Supported formats:");
    console.error("  username/repo");
    console.error("  git@github.com:username/repo.git");
    console.error("  https://github.com/username/repo.git");
    process.exit(1);
  }

  // Clone if not already cloned
  if (await isGitRepo(repoInfo.fullPath)) {
    console.log(yellow(`${repoInfo.displayName} already exists at ${repoInfo.fullPath}`));
  } else {
    console.log(`Cloning ${repoInfo.displayName}...`);
    const success = await cloneRepo(fullUrl, repoInfo.fullPath);
    if (success) {
      console.log(green(`Cloned to ${repoInfo.fullPath}`));
    } else {
      console.error(red(`Failed to clone ${repoInfo.displayName}`));
      process.exit(1);
    }
  }
}
