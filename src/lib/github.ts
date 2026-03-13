export interface GhRepo {
  nameWithOwner: string;
  description: string | null;
}

export async function runGhRepoList(owner?: string): Promise<GhRepo[]> {
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

export async function fetchGhOrgs(): Promise<string[]> {
  const proc = Bun.spawn(
    ["gh", "api", "user/orgs", "--jq", ".[].login"],
    { stdout: "pipe", stderr: "pipe" }
  );
  const output = await new Response(proc.stdout).text();
  await proc.exited;

  return output.trim().split("\n").filter(Boolean);
}

export async function fetchGhRepos(): Promise<GhRepo[]> {
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
