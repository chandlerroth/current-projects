/**
 * Execute git command and pipe output to console
 */
export async function executeGit(
  args: string[],
  cwd?: string
): Promise<{ exitCode: number }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
  await proc.exited;
  return { exitCode: proc.exitCode ?? 1 };
}

/**
 * Execute git command and capture output
 */
export async function executeGitWithOutput(
  args: string[],
  cwd?: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;

  return {
    exitCode: proc.exitCode ?? 1,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

/**
 * Execute git command silently (no output)
 */
export async function executeGitQuiet(
  args: string[],
  cwd?: string
): Promise<{ exitCode: number }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "ignore",
    stderr: "ignore",
  });
  await proc.exited;
  return { exitCode: proc.exitCode ?? 1 };
}

/**
 * Clone a repository
 */
export async function cloneRepo(url: string, targetDir: string): Promise<boolean> {
  const { exitCode } = await executeGit(["clone", url, targetDir]);
  return exitCode === 0;
}

/**
 * Fetch from remote
 */
export async function fetch(cwd: string): Promise<boolean> {
  const { exitCode } = await executeGitQuiet(["fetch"], cwd);
  return exitCode === 0;
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(cwd: string): Promise<string | null> {
  const { exitCode, stdout } = await executeGitWithOutput(
    ["rev-parse", "--abbrev-ref", "HEAD"],
    cwd
  );
  return exitCode === 0 ? stdout : null;
}

/**
 * Get upstream tracking branch
 */
export async function getUpstream(cwd: string): Promise<string | null> {
  const { exitCode, stdout } = await executeGitWithOutput(
    ["rev-parse", "--abbrev-ref", "@{u}"],
    cwd
  );
  return exitCode === 0 ? stdout : null;
}

/**
 * Get number of commits ahead/behind
 */
export async function getAheadBehind(
  cwd: string,
  compareBranch: string
): Promise<{ ahead: number; behind: number }> {
  const { exitCode, stdout } = await executeGitWithOutput(
    ["rev-list", "--left-right", "--count", `${compareBranch}...HEAD`],
    cwd
  );

  if (exitCode !== 0) {
    return { ahead: 0, behind: 0 };
  }

  const parts = stdout.split(/\s+/);
  if (parts.length === 2) {
    return {
      behind: parseInt(parts[0], 10) || 0,
      ahead: parseInt(parts[1], 10) || 0,
    };
  }
  return { ahead: 0, behind: 0 };
}

/**
 * Get count of changed files
 */
export async function getChangedFilesCount(cwd: string): Promise<number> {
  const { exitCode, stdout } = await executeGitWithOutput(
    ["status", "--porcelain"],
    cwd
  );

  if (exitCode !== 0 || !stdout) {
    return 0;
  }

  return stdout.split("\n").filter(Boolean).length;
}

/**
 * Check if a branch exists
 */
export async function branchExists(cwd: string, branch: string): Promise<boolean> {
  const { exitCode } = await executeGitQuiet(
    ["rev-parse", "--verify", branch],
    cwd
  );
  return exitCode === 0;
}

/**
 * Check if repo directory exists and is a git repo
 */
export async function isGitRepo(path: string): Promise<boolean> {
  const proc = Bun.spawn(["test", "-d", `${path}/.git`]);
  await proc.exited;
  return proc.exitCode === 0;
}

/**
 * Get count of stashes
 */
export async function getStashCount(cwd: string): Promise<number> {
  const { exitCode, stdout } = await executeGitWithOutput(["stash", "list"], cwd);
  if (exitCode !== 0 || !stdout) return 0;
  return stdout.split("\n").filter(Boolean).length;
}
