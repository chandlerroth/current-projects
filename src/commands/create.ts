import { PROJECTS_DIR } from "../lib/paths.ts";
import { cloneRepo, isGitRepo } from "../lib/git.ts";
import { green, red } from "../lib/colors.ts";
import { join } from "path";

async function getGitHubUsername(): Promise<string | null> {
  const proc = Bun.spawn(["gh", "api", "user", "--jq", ".login"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  if (proc.exitCode !== 0) return null;
  return stdout.trim();
}

export async function runCreate(repoName: string | undefined): Promise<void> {
  if (!repoName) {
    console.error(red("Usage: prj create <repo-name>"));
    console.error("Examples:");
    console.error("  prj create my-app");
    console.error("  prj create myorg/my-app");
    process.exit(1);
  }

  if (repoName.startsWith("-")) {
    console.error(red(`Invalid repo name: ${repoName}`));
    console.error("Repo names cannot start with a dash.");
    process.exit(1);
  }

  // Determine owner and repo name
  let owner: string;
  let name: string;
  if (repoName.includes("/")) {
    const parts = repoName.split("/");
    owner = parts[0];
    name = parts[1];
  } else {
    const username = await getGitHubUsername();
    if (!username) {
      console.error(red("Failed to get GitHub username. Is `gh` authenticated?"));
      console.error("Run: gh auth login");
      process.exit(1);
    }
    owner = username;
    name = repoName;
  }

  const fullName = `${owner}/${name}`;
  const localPath = join(PROJECTS_DIR, owner.toLowerCase(), name.toLowerCase());

  // Check if already exists locally
  if (await isGitRepo(localPath)) {
    console.error(red(`${fullName} already exists at ${localPath}`));
    process.exit(1);
  }

  // Create the repo on GitHub (no clone yet)
  console.log(`Creating private repo ${fullName}...`);
  const createProc = Bun.spawn(
    ["gh", "repo", "create", fullName, "--private"],
    {
      stdout: "inherit",
      stderr: "inherit",
    }
  );
  await createProc.exited;

  if (createProc.exitCode !== 0) {
    console.error(red(`Failed to create repository ${fullName}`));
    process.exit(1);
  }

  // Get the SSH URL for cloning
  const urlProc = Bun.spawn(
    ["gh", "repo", "view", fullName, "--json", "sshUrl", "--jq", ".sshUrl"],
    { stdout: "pipe", stderr: "pipe" }
  );
  const sshUrl = (await new Response(urlProc.stdout).text()).trim();
  await urlProc.exited;

  const cloneUrl = sshUrl || `git@github.com:${fullName}.git`;

  // Clone to the correct path
  console.log(`Cloning ${fullName}...`);
  const success = await cloneRepo(cloneUrl, localPath);
  if (!success) {
    console.error(red(`Failed to clone ${fullName}`));
    process.exit(1);
  }

  console.log(green(`Created and cloned ${fullName} to ${localPath}`));
}
