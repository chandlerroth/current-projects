import { homedir } from "os";
import { join, dirname } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "fs";

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
  const dir = dirname(path);
  // Restrict the parent dir to user-only on creation. `mkdirSync` honors mode
  // only when actually creating; it won't tighten an existing dir's perms.
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Atomic write with restricted mode set on creation, so no other process
  // can ever observe the file at the default umask. We write to a sibling
  // tempfile and rename — rename is atomic on POSIX and preserves the mode.
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, path);
}
