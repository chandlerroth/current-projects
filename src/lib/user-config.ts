import { homedir } from "os";
import { join, dirname } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "fs";

export const CONFIG_PATH = join(homedir(), ".config", "prj", "config.json");

export interface UserConfig {
  githubToken?: string;
}

export function readConfig(): UserConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as UserConfig;
  } catch {
    return {};
  }
}

export function writeConfig(cfg: UserConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n");
  // Token is sensitive — restrict to user only.
  try { chmodSync(CONFIG_PATH, 0o600); } catch {}
}
