import { homedir } from "os";
import { join, dirname } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "fs";

/**
 * Resolve the config path lazily so tests (and re-`HOME`-ed shells) see the
 * current value. We read $HOME directly because Node/Bun's os.homedir()
 * caches the result on first call.
 */
export function configPath(): string {
  const home = process.env.HOME || homedir();
  return join(home, ".config", "prj", "config.json");
}

export interface UserConfig {
  githubToken?: string;
}

export function readConfig(): UserConfig {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as UserConfig;
  } catch {
    return {};
  }
}

export function writeConfig(cfg: UserConfig): void {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
  // Token is sensitive — restrict to user only.
  try { chmodSync(path, 0o600); } catch {}
}
