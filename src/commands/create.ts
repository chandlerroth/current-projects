import { PROJECTS_DIR, parseRepoUrl } from "../lib/paths.ts";
import { cloneRepo, isGitRepo, executeGitWithOutput, executeGit } from "../lib/git.ts";
import { green, red, yellow } from "../lib/colors.ts";
import { join, basename } from "path";
import { mkdirSync, renameSync } from "fs";

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

async function runCreateFromCwd(): Promise<void> {
  const cwd = process.cwd();

  if (!(await isGitRepo(cwd))) {
    console.error(red("Current directory is not a git repo."));
    process.exit(1);
  }

  const username = await getGitHubUsername();
  if (!username) {
    console.error(red("Failed to get GitHub username. Is `gh` authenticated?"));
    console.error("Run: gh auth login");
    process.exit(1);
  }

  const name = basename(cwd);
  const fullName = `${username}/${name}`;

  // Check if remote already exists
  const { stdout: remoteUrl } = await executeGitWithOutput(["remote", "get-url", "origin"], cwd);
  if (remoteUrl) {
    console.error(yellow(`Remote 'origin' already set to: ${remoteUrl}`));
    console.error(red("Use a fresh repo without an origin remote, or remove it first."));
    process.exit(1);
  }

  // Create the repo on GitHub
  console.error(`Creating private repo ${fullName}...`);
  const createProc = Bun.spawn(
    ["gh", "repo", "create", fullName, "--private"],
    { stdout: "inherit", stderr: "inherit" }
  );
  await createProc.exited;

  if (createProc.exitCode !== 0) {
    console.error(red(`Failed to create repository ${fullName}`));
    process.exit(1);
  }

  // Add remote origin
  const sshUrl = `git@github.com:${fullName}.git`;
  const { exitCode: addRemoteExit } = await executeGit(["remote", "add", "origin", sshUrl], cwd);
  if (addRemoteExit !== 0) {
    console.error(red("Failed to add remote origin."));
    process.exit(1);
  }

  // Push current branch
  const { stdout: branch } = await executeGitWithOutput(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  if (branch) {
    console.error(`Pushing ${branch} to origin...`);
    await executeGit(["push", "-u", "origin", branch], cwd);
  }

  // Move repo into ~/Projects/<owner>/<name> if not already there
  const targetPath = join(PROJECTS_DIR, username.toLowerCase(), name.toLowerCase());
  if (cwd !== targetPath) {
    mkdirSync(join(PROJECTS_DIR, username.toLowerCase()), { recursive: true });
    renameSync(cwd, targetPath);
    console.error(green(`Moved to ${targetPath}`));
    console.log(targetPath);
  } else {
    console.error(green(`Created repo ${fullName}`));
    console.log(targetPath);
  }
}

export async function runCreate(repoName: string | undefined): Promise<void> {
  if (!repoName) {
    console.error(red("Usage: prj create <repo-name>"));
    console.error("Examples:");
    console.error("  prj create my-app");
    console.error("  prj create myorg/my-app");
    console.error("  prj create .          (publish current dir as a private repo)");
    process.exit(1);
  }

  if (repoName === ".") {
    return runCreateFromCwd();
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
  console.error(`Creating private repo ${fullName}...`);
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
  console.error(`Cloning ${fullName}...`);
  const success = await cloneRepo(cloneUrl, localPath);
  if (!success) {
    console.error(red(`Failed to clone ${fullName}`));
    process.exit(1);
  }

  console.error(green(`Created and cloned ${fullName} to ${localPath}`));
  console.log(localPath);
}
