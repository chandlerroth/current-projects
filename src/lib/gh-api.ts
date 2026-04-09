import { homedir } from "os";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { readConfig } from "./user-config.ts";

export interface GhRepo {
  nameWithOwner: string;
  description: string | null;
}

export interface GhCreatedRepo {
  nameWithOwner: string;
  sshUrl: string;
  htmlUrl: string;
}

const API = "https://api.github.com";
const MAX_PAGES = 10; // hard cap; per_page=100 → 1000 repos max

let cachedToken: string | null | undefined;

/**
 * Resolve a GitHub token from env or ~/.config/gh/hosts.yml.
 * Returns null if no token is found.
 */
export function resolveToken(): string | null {
  if (cachedToken !== undefined) return cachedToken;

  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) {
    cachedToken = envToken;
    return cachedToken;
  }

  const cfg = readConfig();
  if (cfg.githubToken) {
    cachedToken = cfg.githubToken;
    return cachedToken;
  }

  const hostsPath = join(homedir(), ".config", "gh", "hosts.yml");
  if (existsSync(hostsPath)) {
    try {
      const content = readFileSync(hostsPath, "utf8");
      // Match the github.com block's oauth_token. Naive but works for gh's format.
      const match = content.match(/github\.com:[\s\S]*?oauth_token:\s*(\S+)/);
      if (match) {
        cachedToken = match[1];
        return cachedToken;
      }
    } catch {
      // fall through
    }
  }

  cachedToken = null;
  return null;
}

/** For tests: reset the cached token. */
export function _resetTokenCache(): void {
  cachedToken = undefined;
}

function authHeaders(): Record<string, string> {
  const token = resolveToken();
  if (!token) {
    throw new Error(
      "No GitHub token found. Run `prj auth <token>`, set $GITHUB_TOKEN, or run `gh auth login`."
    );
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "prj-cli",
  };
}

async function ghFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    let body = "";
    try { body = await res.text(); } catch {}
    const hint = remaining === "0" ? " (rate limit exhausted)" : "";
    throw new Error(
      `GitHub API ${res.status} ${res.statusText}${hint}: ${body.slice(0, 200)}`
    );
  }
  return res;
}

/** Parse the next page URL from a Link header. */
function parseNextLink(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

async function paginate<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = path;
  let pages = 0;
  while (url && pages < MAX_PAGES) {
    const res: Response = await ghFetch(url);
    const batch = (await res.json()) as T[];
    out.push(...batch);
    url = parseNextLink(res.headers.get("link"));
    pages++;
  }
  return out;
}

interface ApiRepo {
  full_name: string;
  description: string | null;
  archived: boolean;
  ssh_url: string;
  html_url: string;
}

function toGhRepo(r: ApiRepo): GhRepo {
  return { nameWithOwner: r.full_name, description: r.description };
}

/**
 * Fetch all repos the authenticated user has access to (owner + org member +
 * collaborator), excluding archived. Replaces the old gh-based fetchGhRepos.
 */
export async function fetchGhRepos(): Promise<GhRepo[]> {
  const repos = await paginate<ApiRepo>(
    "/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=full_name"
  );
  const seen = new Set<string>();
  const out: GhRepo[] = [];
  for (const r of repos) {
    if (r.archived) continue;
    const key = r.full_name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toGhRepo(r));
  }
  return out;
}

/** Server-side search via GitHub's /search/repositories endpoint. */
export async function searchRepos(query: string): Promise<GhRepo[]> {
  const res = await ghFetch(
    `/search/repositories?q=${encodeURIComponent(query)}&per_page=100`
  );
  const body = (await res.json()) as { items: ApiRepo[] };
  return body.items.map(toGhRepo);
}

/** Get the authenticated user's login. */
export async function getCurrentUser(): Promise<string> {
  const res = await ghFetch("/user");
  const body = (await res.json()) as { login: string };
  return body.login;
}

/**
 * Best-effort delete a repo. Used for rollback after a failed `prj create`.
 * Swallows errors and returns false on failure — the caller is already in an
 * error path and we don't want to clobber the original error.
 */
export async function deleteRepo(owner: string, name: string): Promise<boolean> {
  try {
    await ghFetch(`/repos/${owner}/${name}`, { method: "DELETE" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a new private repo. If owner is the current user, posts to /user/repos.
 * Otherwise posts to /orgs/{owner}/repos. Returns SSH/HTML URLs.
 */
export async function createRepo(
  owner: string,
  name: string
): Promise<GhCreatedRepo> {
  const me = await getCurrentUser();
  const path =
    owner.toLowerCase() === me.toLowerCase()
      ? "/user/repos"
      : `/orgs/${owner}/repos`;
  const res = await ghFetch(path, {
    method: "POST",
    body: JSON.stringify({ name, private: true }),
  });
  const body = (await res.json()) as ApiRepo;
  return {
    nameWithOwner: body.full_name,
    sshUrl: body.ssh_url,
    htmlUrl: body.html_url,
  };
}
