import { readConfig, writeConfig, configPath } from "../lib/user-config.ts";
import { green, red, gray, yellow } from "../lib/colors.ts";
import { _resetTokenCache, getCurrentUser } from "../lib/gh-api.ts";
import { select } from "../lib/prompt.ts";

/** Check whether `gh` is installed and reachable on PATH. */
async function ghInstalled(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["gh", "--version"], { stdout: "ignore", stderr: "ignore" });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/** Read the gh CLI's stored token via `gh auth token`. */
async function ghAuthToken(): Promise<string | null> {
  try {
    const proc = Bun.spawn(["gh", "auth", "token"], { stdout: "pipe", stderr: "ignore" });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    if (proc.exitCode !== 0) return null;
    const trimmed = out.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

/** Minimal line-buffered text prompt to stderr. Returns null on EOF/Ctrl+C. */
async function promptText(label: string, opts: { mask?: boolean } = {}): Promise<string | null> {
  process.stderr.write(label);
  const isTTY = !!process.stdin.isTTY;
  if (isTTY && opts.mask) process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve) => {
    let buf = "";
    const onData = (data: Buffer) => {
      const s = data.toString();
      for (const ch of s) {
        if (ch === "\x03") { // Ctrl+C
          cleanup();
          process.stderr.write("\n");
          return resolve(null);
        }
        if (ch === "\r" || ch === "\n") {
          cleanup();
          process.stderr.write("\n");
          return resolve(buf);
        }
        if (ch === "\x7f" || ch === "\b") {
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            if (opts.mask && isTTY) process.stderr.write("\b \b");
          }
          continue;
        }
        buf += ch;
        if (opts.mask && isTTY) process.stderr.write("*");
      }
    };
    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      if (isTTY && opts.mask) process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on("data", onData);
  });
}

async function saveAndVerify(token: string): Promise<void> {
  // Verify FIRST so a bad token can't clobber a good saved one. We swap the
  // env var (highest-priority source) for the verification call, then restore.
  const prevEnv = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = token;
  _resetTokenCache();
  let user: string;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (prevEnv === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prevEnv;
    _resetTokenCache();
    console.error(red(e instanceof Error ? e.message : "Token verification failed"));
    console.error(yellow("Existing token (if any) was left untouched."));
    process.exit(1);
  }
  // Restore env, then persist to config.
  if (prevEnv === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = prevEnv;
  const cfg = readConfig();
  cfg.githubToken = token;
  writeConfig(cfg);
  _resetTokenCache();
  console.error(green(`Authenticated as ${user}`));
  console.error(gray(`Token saved to ${configPath()}`));
}

/**
 * Interactive login flow: detects gh, offers to import its token or accept a
 * manually-pasted one. Falls back to manual-only if gh is missing.
 */
async function interactiveLogin(): Promise<void> {
  const hasGh = await ghInstalled();

  if (hasGh) {
    const choice = await select([
      { label: "Import token from gh CLI", value: "gh", hint: gray("uses `gh auth token`") },
      { label: "Paste a token manually", value: "manual", hint: gray("github.com/settings/tokens") },
    ]);
    if (!choice) return;

    if (choice === "gh") {
      const tok = await ghAuthToken();
      if (!tok) {
        console.error(red("`gh auth token` returned nothing. Are you logged in to gh?"));
        console.error(gray("Run: gh auth login"));
        process.exit(1);
      }
      await saveAndVerify(tok);
      return;
    }
  } else {
    console.error(gray("`gh` not detected — falling back to manual token entry."));
  }

  console.error(gray("Create a token at https://github.com/settings/tokens (scope: repo)"));
  const tok = await promptText("GitHub token: ", { mask: true });
  if (!tok) {
    console.error(yellow("Cancelled."));
    return;
  }
  await saveAndVerify(tok.trim());
}

function mask(token: string): string {
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function emitAuthJson(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

async function runAuthNonInteractive(
  action: string | undefined,
  token: string | undefined,
): Promise<void> {
  const a = action || "status";
  if (a !== "status" && a !== "login" && a !== "logout") {
    emitAuthJson({ success: false, action: a, error: `Unknown action: ${a}. Use status, login, or logout.` });
    process.exit(1);
  }

  if (a === "logout") {
    const cfg = readConfig();
    delete cfg.githubToken;
    writeConfig(cfg);
    _resetTokenCache();
    emitAuthJson({ success: true, action: "logout" });
    return;
  }

  if (a === "login") {
    if (!token) {
      emitAuthJson({ success: false, action: "login", error: "Missing token. Pass `--token=<token>`." });
      process.exit(1);
    }
    const prevEnv = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = token;
    _resetTokenCache();
    let user: string;
    try {
      user = await getCurrentUser();
    } catch (e) {
      if (prevEnv === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = prevEnv;
      _resetTokenCache();
      emitAuthJson({ success: false, action: "login", error: e instanceof Error ? e.message : "Token verification failed" });
      process.exit(1);
    }
    if (prevEnv === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prevEnv;
    const cfg = readConfig();
    cfg.githubToken = token;
    writeConfig(cfg);
    _resetTokenCache();
    emitAuthJson({ success: true, action: "login", user });
    return;
  }

  // status
  const cfg = readConfig();
  const envTok = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const tokenSource = cfg.githubToken ? "config" : envTok ? "env" : null;
  if (!tokenSource) {
    emitAuthJson({ success: true, action: "status", authenticated: false, user: null, tokenSource: null });
    return;
  }
  try {
    const user = await getCurrentUser();
    emitAuthJson({ success: true, action: "status", authenticated: true, user, tokenSource });
  } catch (e) {
    emitAuthJson({ success: false, action: "status", error: e instanceof Error ? e.message : "Token invalid", tokenSource });
    process.exit(1);
  }
}

export async function runAuth(
  sub: string | undefined,
  token: string | undefined,
  nonInteractive = false,
  actionFlag?: string,
): Promise<void> {
  if (nonInteractive) return runAuthNonInteractive(actionFlag ?? sub, token);

  // `prj auth` with no args = status
  // `prj auth <token>` = save (shorthand for `prj auth login <token>`)
  // `prj auth login <token>` = save
  // `prj auth logout` = clear
  // `prj auth status` = show current
  let action: "status" | "login" | "logout";
  let tok: string | undefined;

  // Reserved subcommands. Anything else is treated as a shorthand token, but
  // only if it actually looks like one (so typos like `prj auth help` don't
  // silently get persisted as the token).
  const RESERVED = new Set(["help", "status", "login", "logout"]);

  if (!sub) {
    action = "status";
  } else if (sub === "logout") {
    action = "logout";
  } else if (sub === "status") {
    action = "status";
  } else if (sub === "login") {
    action = "login";
    tok = token;
  } else if (sub === "help") {
    console.error("prj auth — Manage your GitHub token");
    console.error("");
    console.error("Usage:");
    console.error("  prj auth                Show current auth status");
    console.error("  prj auth login          Interactive login (gh import or paste)");
    console.error("  prj auth login <token>  Save a token");
    console.error("  prj auth <token>        Same as `auth login <token>`");
    console.error("  prj auth logout         Remove the saved token");
    return;
  } else if (RESERVED.has(sub) || !/^(gh[pous]_|github_pat_)[A-Za-z0-9_]{20,}$/.test(sub)) {
    // Doesn't look like a GitHub token — refuse before we touch anything.
    console.error(red(`Unknown subcommand: ${sub}`));
    console.error("Run 'prj auth help' for usage.");
    process.exit(1);
  } else {
    // shorthand: `prj auth ghp_xxx`
    action = "login";
    tok = sub;
  }

  if (action === "logout") {
    const cfg = readConfig();
    delete cfg.githubToken;
    writeConfig(cfg);
    _resetTokenCache();
    console.error(green("Token removed."));
    return;
  }

  if (action === "login") {
    if (!tok) {
      await interactiveLogin();
      return;
    }
    await saveAndVerify(tok);
    return;
  }

  // status
  const cfg = readConfig();
  if (cfg.githubToken) {
    console.error(`Token: ${mask(cfg.githubToken)} ${gray(`(${configPath()})`)}`);
    try {
      const user = await getCurrentUser();
      console.error(green(`Authenticated as ${user}`));
    } catch (e) {
      console.error(red(e instanceof Error ? e.message : "Token invalid"));
      process.exit(1);
    }
  } else if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
    console.error(gray("Using token from $GITHUB_TOKEN/$GH_TOKEN"));
    try {
      const user = await getCurrentUser();
      console.error(green(`Authenticated as ${user}`));
    } catch (e) {
      console.error(red(e instanceof Error ? e.message : "Token invalid"));
      process.exit(1);
    }
  } else {
    console.error(yellow("Not authenticated."));
    await interactiveLogin();
  }
}
