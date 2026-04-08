import { expandRepoUrl, parseRepoUrl } from "../lib/paths.ts";
import { scanProjects } from "../lib/config.ts";
import { cloneRepo, isGitRepo } from "../lib/git.ts";
import { green, red, yellow, gray } from "../lib/colors.ts";
import { select } from "../lib/prompt.ts";
import { Spinner } from "../lib/spinner.ts";
import { fetchGhRepos, searchRepos, type GhRepo } from "../lib/gh-api.ts";

export async function runSearch(query: string | undefined, nonInteractive: boolean): Promise<void> {
  const spinner = new Spinner(query ? `Searching GitHub for "${query}"...` : "Fetching repos from GitHub...");
  spinner.start();

  let results: GhRepo[];
  try {
    // Use server-side search when a query is given; otherwise list everything.
    results = query ? await searchRepos(query) : await fetchGhRepos();
  } catch (error) {
    spinner.stop();
    if (error instanceof Error) {
      console.error(red(error.message));
    } else {
      console.error(red("Failed to fetch repos from GitHub."));
    }
    process.exit(1);
  }

  // Build set of cloned repos (lowercased for case-insensitive match)
  const cloned = new Set(scanProjects().map((r) => r.displayName.toLowerCase()));

  spinner.stop();

  if (results.length === 0) {
    process.stderr.write(yellow(query ? `No repos matching "${query}".\n` : "No repos found.\n"));
    return;
  }

  if (nonInteractive) {
    const output = results.map((r) => ({
      nameWithOwner: r.nameWithOwner,
      description: r.description,
      cloned: cloned.has(r.nameWithOwner.toLowerCase()),
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Interactive mode
  const maxNameLen = Math.max(...results.map((r) => r.nameWithOwner.length));

  const options = results.map((repo) => {
    const isCloned = cloned.has(repo.nameWithOwner.toLowerCase());
    const status = isCloned ? green("(cloned)") : gray("(not cloned)");
    const desc = repo.description ? ` ${gray(repo.description)}` : "";
    return {
      label: repo.nameWithOwner.padEnd(maxNameLen),
      value: repo.nameWithOwner,
      hint: `${status}${desc}`,
    };
  });

  const selected = await select(options);
  if (!selected) return;

  const isSelectedCloned = cloned.has(selected.toLowerCase());

  if (isSelectedCloned) {
    // Print path like `list` does
    const project = scanProjects().find((r) => r.displayName.toLowerCase() === selected.toLowerCase());
    if (project) {
      console.log(project.fullPath);
    }
  } else {
    // Clone like `add` does
    const fullUrl = expandRepoUrl(selected);
    const repoInfo = parseRepoUrl(fullUrl);
    if (!repoInfo) {
      console.error(red("Invalid repository format"));
      process.exit(1);
    }

    if (await isGitRepo(repoInfo.fullPath)) {
      console.error(yellow(`${repoInfo.displayName} already exists at ${repoInfo.fullPath}`));
      console.log(repoInfo.fullPath);
    } else {
      console.error(`Cloning ${repoInfo.displayName}...`);
      const success = await cloneRepo(fullUrl, repoInfo.fullPath);
      if (success) {
        console.error(green(`Cloned to ${repoInfo.fullPath}`));
        console.log(repoInfo.fullPath);
      } else {
        console.error(red(`Failed to clone ${repoInfo.displayName}`));
        process.exit(1);
      }
    }
  }
}
