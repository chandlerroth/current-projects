import { PROJECTS_DIR } from "../lib/paths.ts";
import { cloneRepo, isGitRepo, executeGitWithOutput, executeGit } from "../lib/git.ts";
import { green, red, yellow } from "../lib/colors.ts";
import { join, basename } from "path";
import { mkdirSync, renameSync } from "fs";
import { createRepo, getCurrentUser } from "../lib/gh-api.ts";
import { Spinner } from "../lib/spinner.ts";

async function runCreateFromCwd(): Promise<void> {
  const cwd = process.cwd();

  if (!(await isGitRepo(cwd))) {
    console.error(red("Current directory is not a git repo."));
    process.exit(1);
  }

  let username: string;
  try {
    username = await getCurrentUser();
  } catch (e) {
    console.error(red(e instanceof Error ? e.message : "Failed to get GitHub user."));
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

  const spinner = new Spinner(`Creating private repo ${fullName}...`);
  spinner.start();
  let created;
  try {
    created = await createRepo(username, name);
  } catch (e) {
    spinner.stop();
    console.error(red(e instanceof Error ? e.message : `Failed to create ${fullName}`));
    process.exit(1);
  }
  spinner.stop();

  // Add remote origin
  const { exitCode: addRemoteExit } = await executeGit(["remote", "add", "origin", created.sshUrl], cwd);
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
    try {
      owner = await getCurrentUser();
    } catch (e) {
      console.error(red(e instanceof Error ? e.message : "Failed to get GitHub user."));
      process.exit(1);
    }
    name = repoName;
  }

  const fullName = `${owner}/${name}`;
  const localPath = join(PROJECTS_DIR, owner.toLowerCase(), name.toLowerCase());

  // Check if already exists locally
  if (await isGitRepo(localPath)) {
    console.error(red(`${fullName} already exists at ${localPath}`));
    process.exit(1);
  }

  const spinner = new Spinner(`Creating private repo ${fullName}...`);
  spinner.start();
  let created;
  try {
    created = await createRepo(owner, name);
  } catch (e) {
    spinner.stop();
    console.error(red(e instanceof Error ? e.message : `Failed to create ${fullName}`));
    process.exit(1);
  }
  spinner.stop();

  // Clone to the correct path
  console.error(`Cloning ${fullName}...`);
  const success = await cloneRepo(created.sshUrl, localPath);
  if (!success) {
    console.error(red(`Failed to clone ${fullName}`));
    process.exit(1);
  }

  console.error(green(`Created and cloned ${fullName} to ${localPath}`));
  console.log(localPath);
}
