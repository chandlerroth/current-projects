import { CONFIG_FILE, PROJECTS_DIR, parseRepoUrl, type RepoInfo } from "./paths.ts";

const CONFIG_TEMPLATE = `# Current Projects Configuration
# Add your git repository URLs below, one per line
# Supports SSH (git@github.com:user/repo.git) and HTTPS formats
#
# Example:
# git@github.com:username/repo.git
`;

/**
 * Check if config file exists
 */
export async function configExists(): Promise<boolean> {
  return await Bun.file(CONFIG_FILE).exists();
}

/**
 * Check if projects directory exists
 */
export async function projectsDirExists(): Promise<boolean> {
  const file = Bun.file(PROJECTS_DIR);
  try {
    // Check if it's a directory by attempting to access it
    const proc = Bun.spawn(["test", "-d", PROJECTS_DIR]);
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Create the config file with template
 */
export async function createConfig(): Promise<void> {
  await Bun.write(CONFIG_FILE, CONFIG_TEMPLATE);
}

/**
 * Create the projects directory
 */
export async function createProjectsDir(): Promise<void> {
  const proc = Bun.spawn(["mkdir", "-p", PROJECTS_DIR]);
  await proc.exited;
}

/**
 * Read all repo URLs from config file
 */
export async function readRepoUrls(): Promise<string[]> {
  if (!(await configExists())) {
    return [];
  }
  const content = await Bun.file(CONFIG_FILE).text();
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

/**
 * Read all repos with parsed info
 */
export async function readRepos(): Promise<RepoInfo[]> {
  const urls = await readRepoUrls();
  const repos: RepoInfo[] = [];
  for (const url of urls) {
    const info = parseRepoUrl(url);
    if (info) {
      repos.push(info);
    }
  }
  return repos;
}

/**
 * Add a repo URL to config file
 */
export async function addRepoToConfig(repoUrl: string): Promise<void> {
  if (!(await projectsDirExists())) {
    await createProjectsDir();
  }
  if (!(await configExists())) {
    await createConfig();
  }
  const content = await Bun.file(CONFIG_FILE).text();
  const newContent = content.endsWith("\n")
    ? content + repoUrl + "\n"
    : content + "\n" + repoUrl + "\n";
  await Bun.write(CONFIG_FILE, newContent);
}

/**
 * Check if repo URL is already in config
 */
export async function repoExistsInConfig(repoUrl: string): Promise<boolean> {
  const urls = await readRepoUrls();
  const normalizedNew = repoUrl.toLowerCase().replace(/\.git$/, "");
  return urls.some((url) => url.toLowerCase().replace(/\.git$/, "") === normalizedNew);
}

/**
 * Remove a repo URL from config file
 */
export async function removeRepoFromConfig(repoUrl: string): Promise<void> {
  const content = await Bun.file(CONFIG_FILE).text();
  const normalizedTarget = repoUrl.toLowerCase().replace(/\.git$/, "");

  const lines = content.split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return true;
    return trimmed.toLowerCase().replace(/\.git$/, "") !== normalizedTarget;
  });

  await Bun.write(CONFIG_FILE, filtered.join("\n"));
}
