import { readdirSync } from "fs";
import { join } from "path";
import { PROJECTS_DIR, type RepoInfo } from "./paths.ts";

/**
 * Check if projects directory exists
 */
export async function projectsDirExists(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["test", "-d", PROJECTS_DIR]);
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Create the projects directory
 */
export async function createProjectsDir(): Promise<void> {
  const proc = Bun.spawn(["mkdir", "-p", PROJECTS_DIR]);
  await proc.exited;
}

/**
 * Scan ~/Projects/<org>/<repo> directories and return all projects.
 * The filesystem is the config — no config file needed.
 */
export function scanProjects(): RepoInfo[] {
  const repos: RepoInfo[] = [];
  try {
    const orgs = readdirSync(PROJECTS_DIR, { withFileTypes: true });
    for (const org of orgs) {
      if (!org.isDirectory() || org.name.startsWith(".")) continue;
      const orgPath = join(PROJECTS_DIR, org.name);
      const projects = readdirSync(orgPath, { withFileTypes: true });
      for (const project of projects) {
        if (!project.isDirectory() || project.name.startsWith(".")) continue;
        repos.push({
          username: org.name,
          repoName: project.name,
          fullPath: join(orgPath, project.name),
          displayName: `${org.name}/${project.name}`,
        });
      }
    }
  } catch {
    // ~/Projects doesn't exist yet
  }
  return repos.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
