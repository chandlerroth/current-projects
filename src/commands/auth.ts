import { readConfig, writeConfig, CONFIG_PATH } from "../lib/user-config.ts";
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
  const cfg = readConfig();
  cfg.githubToken = token;
  writeConfig(cfg);
  _resetTokenCache();
  try {
    const user = await getCurrentUser();
    console.error(green(`Authenticated as ${user}`));
    console.error(gray(`Token saved to ${CONFIG_PATH}`));
  } catch (e) {
    console.error(red(e instanceof Error ? e.message : "Token verification failed"));
    process.exit(1);
  }
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

export async function runAuth(sub: string | undefined, token: string | undefined): Promise<void> {
  // `prj auth` with no args = status
  // `prj auth <token>` = save (shorthand for `prj auth login <token>`)
  // `prj auth login <token>` = save
  // `prj auth logout` = clear
  // `prj auth status` = show current
  let action: "status" | "login" | "logout";
  let tok: string | undefined;

  if (!sub) {
    action = "status";
  } else if (sub === "logout") {
    action = "logout";
  } else if (sub === "status") {
    action = "status";
  } else if (sub === "login") {
    action = "login";
    tok = token;
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
    console.error(`Token: ${mask(cfg.githubToken)} ${gray(`(${CONFIG_PATH})`)}`);
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
