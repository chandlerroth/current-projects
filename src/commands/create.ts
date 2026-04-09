import { projectsDir } from "../lib/paths.ts";
import { cloneRepo, isGitRepo, executeGitWithOutput, executeGit } from "../lib/git.ts";
import { green, red, yellow } from "../lib/colors.ts";
import { join, basename } from "path";
import { mkdirSync, renameSync } from "fs";
import { rmSync } from "fs";
import { createRepo, deleteRepo, getCurrentUser } from "../lib/gh-api.ts";
import { Spinner } from "../lib/spinner.ts";

/**
 * Best-effort rollback after a partial `create`. We delete the GitHub repo we
 * just made (if any) and any partially-cloned local directory. Errors here are
 * intentionally swallowed — the caller is already in an error path and the
 * original cause is what the user needs to see.
 */
async function rollbackCreate(opts: {
  owner?: string;
  name?: string;
  localPath?: string;
}): Promise<string | null> {
  const notes: string[] = [];
  if (opts.owner && opts.name) {
    const ok = await deleteRepo(opts.owner, opts.name);
    notes.push(ok ? `deleted ${opts.owner}/${opts.name} on GitHub` : `could not delete ${opts.owner}/${opts.name} on GitHub — clean up manually`);
  }
  if (opts.localPath) {
    try {
      rmSync(opts.localPath, { recursive: true, force: true });
      notes.push(`removed ${opts.localPath}`);
    } catch {
      // ignore
    }
  }
  return notes.length ? notes.join("; ") : null;
}

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
    const note = await rollbackCreate({ owner: username, name });
    console.error(red("Failed to add remote origin."));
    if (note) console.error(yellow(`Rolled back: ${note}`));
    process.exit(1);
  }

  // Push current branch
  const { stdout: branch } = await executeGitWithOutput(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  if (branch) {
    console.error(`Pushing ${branch} to origin...`);
    const { exitCode: pushExit } = await executeGit(["push", "-u", "origin", branch], cwd);
    if (pushExit !== 0) {
      // Best-effort: also try to drop the just-added remote so the user's local
      // state is restored to "no origin".
      await executeGit(["remote", "remove", "origin"], cwd);
      const note = await rollbackCreate({ owner: username, name });
      console.error(red(`Failed to push ${branch} to origin.`));
      if (note) console.error(yellow(`Rolled back: ${note}`));
      process.exit(1);
    }
  }

  // Move repo into ~/Projects/<owner>/<name> if not already there
  const root = projectsDir();
  const targetPath = join(root, username.toLowerCase(), name.toLowerCase());
  if (cwd !== targetPath) {
    mkdirSync(join(root, username.toLowerCase()), { recursive: true });
    renameSync(cwd, targetPath);
    console.error(green(`Moved to ${targetPath}`));
    console.log(targetPath);
  } else {
    console.error(green(`Created repo ${fullName}`));
    console.log(targetPath);
  }
}

function emitJson(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

async function runCreateNonInteractive(repoName: string | undefined): Promise<void> {
  if (!repoName) {
    emitJson({ success: false, error: "Missing name. Pass `--name=<name|org/name>`." });
    process.exit(1);
  }
  if (repoName === ".") {
    // Publish-from-cwd path. Reuses interactive flow but its output is text;
    // for non-interactive we re-implement the minimum needed to emit JSON.
    const cwd = process.cwd();
    if (!(await isGitRepo(cwd))) {
      emitJson({ success: false, error: "Current directory is not a git repo." });
      process.exit(1);
    }
    let username: string;
    try {
      username = await getCurrentUser();
    } catch (e) {
      emitJson({ success: false, error: e instanceof Error ? e.message : "Failed to get GitHub user." });
      process.exit(1);
    }
    const name = basename(cwd);
    const fullName = `${username}/${name}`;
    const { stdout: remoteUrl } = await executeGitWithOutput(["remote", "get-url", "origin"], cwd);
    if (remoteUrl) {
      emitJson({ success: false, error: `Remote 'origin' already set to ${remoteUrl}` });
      process.exit(1);
    }
    let created;
    try {
      created = await createRepo(username, name);
    } catch (e) {
      emitJson({ success: false, error: e instanceof Error ? e.message : `Failed to create ${fullName}` });
      process.exit(1);
    }
    const { exitCode: addExit } = await executeGit(["remote", "add", "origin", created.sshUrl], cwd);
    if (addExit !== 0) {
      const note = await rollbackCreate({ owner: username, name });
      emitJson({ success: false, error: "Failed to add remote origin.", rollback: note });
      process.exit(1);
    }
    const { stdout: branch } = await executeGitWithOutput(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    if (branch) {
      const { exitCode: pushExit } = await executeGit(["push", "-u", "origin", branch], cwd);
      if (pushExit !== 0) {
        await executeGit(["remote", "remove", "origin"], cwd);
        const note = await rollbackCreate({ owner: username, name });
        emitJson({ success: false, error: `Failed to push ${branch} to origin.`, rollback: note });
        process.exit(1);
      }
    }

    const root = projectsDir();
    const targetPath = join(root, username.toLowerCase(), name.toLowerCase());
    if (cwd !== targetPath) {
      mkdirSync(join(root, username.toLowerCase()), { recursive: true });
      renameSync(cwd, targetPath);
    }
    emitJson({
      success: true,
      nameWithOwner: created.nameWithOwner,
      fullPath: targetPath,
      sshUrl: created.sshUrl,
    });
    return;
  }

  if (repoName.startsWith("-")) {
    emitJson({ success: false, error: `Invalid repo name: ${repoName}` });
    process.exit(1);
  }

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
      emitJson({ success: false, error: e instanceof Error ? e.message : "Failed to get GitHub user." });
      process.exit(1);
    }
    name = repoName;
  }
  const fullName = `${owner}/${name}`;
  const localPath = join(projectsDir(), owner.toLowerCase(), name.toLowerCase());

  if (await isGitRepo(localPath)) {
    emitJson({ success: false, error: `${fullName} already exists at ${localPath}` });
    process.exit(1);
  }
  let created;
  try {
    created = await createRepo(owner, name);
  } catch (e) {
    emitJson({ success: false, error: e instanceof Error ? e.message : `Failed to create ${fullName}` });
    process.exit(1);
  }
  const ok = await cloneRepo(created.sshUrl, localPath);
  if (!ok) {
    const note = await rollbackCreate({ owner, name, localPath });
    emitJson({ success: false, error: `Failed to clone ${fullName}`, rollback: note });
    process.exit(1);
  }
  emitJson({
    success: true,
    nameWithOwner: created.nameWithOwner,
    fullPath: localPath,
    sshUrl: created.sshUrl,
  });
}

export async function runCreate(
  repoName: string | undefined,
  nonInteractive = false,
): Promise<void> {
  if (nonInteractive) return runCreateNonInteractive(repoName);

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
  const localPath = join(projectsDir(), owner.toLowerCase(), name.toLowerCase());

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
    const note = await rollbackCreate({ owner, name, localPath });
    console.error(red(`Failed to clone ${fullName}`));
    if (note) console.error(yellow(`Rolled back: ${note}`));
    process.exit(1);
  }

  console.error(green(`Created and cloned ${fullName} to ${localPath}`));
  console.log(localPath);
}
