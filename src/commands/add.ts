import { expandRepoUrl, parseRepoUrl } from "../lib/paths.ts";
import { scanProjects } from "../lib/config.ts";
import { cloneRepo, isGitRepo } from "../lib/git.ts";
import { green, red, yellow, gray } from "../lib/colors.ts";
import { select } from "../lib/prompt.ts";
import { Spinner } from "../lib/spinner.ts";
import { fetchGhRepos, type GhRepo } from "../lib/gh-api.ts";

function emitJson(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

export async function runAdd(
  repoUrl: string | undefined,
  nonInteractive = false,
): Promise<void> {
  // --non-interactive: no picker, no prompts. Require an explicit repo arg.
  if (nonInteractive) {
    if (!repoUrl) {
      emitJson({ success: false, error: "Missing repo argument. Pass `--repo=<url|shorthand>` or a positional repo." });
      process.exit(1);
    }
    const fullUrl = expandRepoUrl(repoUrl);
    const repoInfo = parseRepoUrl(fullUrl);
    if (!repoInfo) {
      emitJson({ success: false, error: `Invalid repository URL format: ${repoUrl}` });
      process.exit(1);
    }
    if (await isGitRepo(repoInfo.fullPath)) {
      emitJson({
        success: true,
        cloned: false,
        displayName: repoInfo.displayName,
        fullPath: repoInfo.fullPath,
      });
      return;
    }
    const ok = await cloneRepo(fullUrl, repoInfo.fullPath);
    if (!ok) {
      emitJson({ success: false, error: `Failed to clone ${repoInfo.displayName}` });
      process.exit(1);
    }
    emitJson({
      success: true,
      cloned: true,
      displayName: repoInfo.displayName,
      fullPath: repoInfo.fullPath,
    });
    return;
  }

  if (!repoUrl) {
    // Interactive mode: fetch repos from GitHub
    const spinner = new Spinner("Fetching repos from GitHub...");
    spinner.start();

    let ghRepos: GhRepo[];
    try {
      ghRepos = await fetchGhRepos();
    } catch (error) {
      spinner.stop();
      if (error instanceof Error) {
        console.error(red(error.message));
      } else {
        console.error(red("Failed to fetch repos from GitHub."));
      }
      process.exit(1);
    }

    // Filter out repos already cloned
    const existing = new Set(scanProjects().map((r) => r.displayName));
    const available = ghRepos.filter((r) => !existing.has(r.nameWithOwner.toLowerCase()));

    spinner.stop();

    if (available.length === 0) {
      process.stderr.write(yellow("All your GitHub repos are already cloned.\n"));
      return;
    }

    const maxNameLen = Math.max(...available.map((r) => r.nameWithOwner.length));

    const options = available.map((repo) => ({
      label: repo.nameWithOwner.padEnd(maxNameLen),
      value: repo.nameWithOwner,
      hint: repo.description ? gray(repo.description) : undefined,
    }));

    const selected = await select(options);
    if (!selected) return;

    repoUrl = selected;
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
    console.error(yellow(`${repoInfo.displayName} already exists at ${repoInfo.fullPath}`));
    console.log(repoInfo.fullPath);
    return;
  }

  console.error(`Cloning ${repoInfo.displayName}...`);
  const success = await cloneRepo(fullUrl, repoInfo.fullPath);
  if (!success) {
    console.error(red(`Failed to clone ${repoInfo.displayName}`));
    process.exit(1);
  }
  console.error(green(`Cloned to ${repoInfo.fullPath}`));
  console.log(repoInfo.fullPath);
}
