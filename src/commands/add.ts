import { expandRepoUrl, parseRepoUrl } from "../lib/paths.ts";
import { scanProjects } from "../lib/config.ts";
import { cloneRepo, isGitRepo } from "../lib/git.ts";
import { green, red, yellow, gray } from "../lib/colors.ts";
import { select } from "../lib/prompt.ts";
import { Spinner } from "../lib/spinner.ts";

interface GhRepo {
  nameWithOwner: string;
  description: string | null;
}

async function runGhRepoList(owner?: string): Promise<GhRepo[]> {
  const args = ["gh", "repo", "list"];
  if (owner) args.push(owner);
  args.push("--limit", "100", "--json", "nameWithOwner,description", "--no-archived");

  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    // Silently skip orgs that fail (e.g. permission issues)
    if (owner) return [];
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`gh repo list failed: ${stderr.trim()}`);
  }

  return JSON.parse(output) as GhRepo[];
}

async function fetchGhOrgs(): Promise<string[]> {
  const proc = Bun.spawn(
    ["gh", "api", "user/orgs", "--jq", ".[].login"],
    { stdout: "pipe", stderr: "pipe" }
  );
  const output = await new Response(proc.stdout).text();
  await proc.exited;

  return output.trim().split("\n").filter(Boolean);
}

async function fetchGhRepos(): Promise<GhRepo[]> {
  // Fetch personal repos and org list concurrently
  const [personalRepos, orgs] = await Promise.all([
    runGhRepoList(),
    fetchGhOrgs(),
  ]);

  // Fetch all org repos concurrently
  const orgResults = await Promise.all(orgs.map((org) => runGhRepoList(org)));
  const orgRepos = orgResults.flat();

  // Deduplicate by nameWithOwner (lowercase)
  const seen = new Set<string>();
  const all: GhRepo[] = [];
  for (const repo of [...personalRepos, ...orgRepos]) {
    const key = repo.nameWithOwner.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      all.push(repo);
    }
  }

  return all;
}

export async function runAdd(repoUrl: string | undefined): Promise<void> {
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
        console.error(red("Failed to fetch repos from GitHub. Is `gh` installed and authenticated?"));
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
