import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, existsSync, statSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// user-config reads HOME at call time (not module load) via os.homedir(),
// which honors process.env.HOME on POSIX. So we can swap HOME per test.

const origHome = process.env.HOME;
let tmpHome: string;

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "prj-uc-"));
  process.env.HOME = tmpHome;
});

afterEach(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
});

async function freshImport() {
  // bun caches modules per URL. Force a re-evaluation by appending a query.
  return await import(`./user-config.ts?t=${Date.now()}${Math.random()}`);
}

test("readConfig returns {} when file is missing", async () => {
  const { readConfig } = await freshImport();
  expect(readConfig()).toEqual({});
});

test("writeConfig creates the file with 0600 perms and round-trips", async () => {
  const { writeConfig, readConfig, configPath } = await freshImport();
  writeConfig({ githubToken: "ghp_secret" });
  expect(existsSync(configPath())).toBe(true);
  expect(readConfig()).toEqual({ githubToken: "ghp_secret" });
  const mode = statSync(configPath()).mode & 0o777;
  expect(mode).toBe(0o600);
});

test("readConfig tolerates malformed JSON", async () => {
  const { readConfig, configPath } = await freshImport();
  mkdirSync(join(tmpHome, ".config", "prj"), { recursive: true });
  writeFileSync(configPath(), "{not json");
  expect(readConfig()).toEqual({});
});
