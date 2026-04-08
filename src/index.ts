import { runInit } from "./commands/init.ts";
import { runAdd } from "./commands/add.ts";
import { runList } from "./commands/list.ts";
import { runDelete } from "./commands/delete.ts";
import { runCreate } from "./commands/create.ts";
import { runSearch } from "./commands/search.ts";
import { runAuth } from "./commands/auth.ts";
import { runShellInit } from "./commands/shell-init.ts";
import { red } from "./lib/colors.ts";

const HELP = `prj - Project Manager

Usage: prj <command> [args]

Commands:
  init                Initialize ~/Projects directory
  add, a [repo]       Clone a repository (interactive picker if no repo given)
  create, c <name>    Create a new private GitHub repo and clone it
  list, l             Interactive project selector
  search, s [query]   Search GitHub repos (interactive picker if no query)
  rm [index|.]        Remove a project (interactive picker if no index given)
  auth [token]        Save a GitHub token (or check status / logout)
  shell-init          Print shell function for auto-cd (eval in your rc file)
  help                Show this help message

Flags:
  --non-interactive   Disable interactive prompts; emit JSON where applicable
  --force             Skip safety checks (rm only)

Environment:
  GITHUB_TOKEN        GitHub API token. Resolution order:
                        1. $GITHUB_TOKEN / $GH_TOKEN
                        2. ~/.config/prj/config.json (set via 'prj auth')
                        3. ~/.config/gh/hosts.yml (gh CLI fallback)

Examples:
  prj init
  prj add user/repo
  prj add
  prj create my-app
  prj list
  prj list --non-interactive
  prj search prj
  prj rm 1 --force
`;

const COMMAND_HELP: Record<string, string> = {
  init: `prj init — Initialize ~/Projects directory\n\nUsage: prj init\n`,
  add: `prj add — Clone a repository\n\nUsage:\n  prj add                Interactive picker over your GitHub repos\n  prj add user/repo      Clone by shorthand\n  prj add <git-url>      Clone by SSH or HTTPS URL\n`,
  create: `prj create — Create a new private GitHub repo and clone it\n\nUsage:\n  prj create <name>      Create under your account\n  prj create org/<name>  Create under an organization\n  prj create .           Publish current directory\n`,
  list: `prj list — List projects\n\nUsage:\n  prj list                       Interactive picker (prints selected path)\n  prj list --non-interactive     Emit JSON status for all projects\n`,
  search: `prj search — Search GitHub repos\n\nUsage:\n  prj search [query]\n  prj search [query] --non-interactive   Emit JSON results\n`,
  rm: `prj rm — Remove a project\n\nUsage:\n  prj rm                 Interactive picker\n  prj rm <index>         Remove by 1-based index\n  prj rm .               Remove the current directory's project\n  prj rm <index> --force Skip safety checks\n`,
  auth: `prj auth — Manage your GitHub token\n\nUsage:\n  prj auth               Show current auth status\n  prj auth <token>       Save a token to ~/.config/prj/config.json\n  prj auth login <token> Same as above\n  prj auth logout        Remove the saved token\n  prj auth status        Show current auth status\n\nCreate a token at https://github.com/settings/tokens (scope: repo)\n`,
  "shell-init": `prj shell-init — Print shell wrapper for auto-cd\n\nUsage:\n  Add this to ~/.zshrc or ~/.bashrc:\n    eval "$(prj shell-init)"\n\nThe wrapper auto-cd's into any directory path printed by prj (e.g.\nfrom 'prj list', 'prj add', 'prj create', 'prj rm').\n`,
};

const ALIASES: Record<string, string> = { a: "add", c: "create", l: "list", s: "search" };

async function preflightGit(): Promise<void> {
  // Cheap existence check; fails fast with a clear message if git is missing.
  try {
    const proc = Bun.spawn(["git", "--version"], { stdout: "ignore", stderr: "ignore" });
    await proc.exited;
    if (proc.exitCode !== 0) throw new Error();
  } catch {
    console.error(red("`git` is required but was not found on PATH."));
    process.exit(1);
  }
}

async function main() {
  const args = Bun.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  const canonical = ALIASES[command] ?? command;

  // Per-command help: `prj <cmd> --help`
  if (args.includes("--help") || args.includes("-h")) {
    console.log(COMMAND_HELP[canonical] ?? HELP);
    return;
  }

  const nonInteractive = args.includes("--non-interactive");
  const force = args.includes("--force");
  // Strip flags from positional args
  const positional = args.filter((a) => !a.startsWith("--"));

  // shell-init just prints text; no git needed (and runs on every shell start).
  if (canonical !== "shell-init") await preflightGit();

  try {
    switch (canonical) {
      case "init":
        await runInit();
        break;

      case "add":
        await runAdd(positional[1]);
        break;

      case "list":
        await runList(nonInteractive);
        break;

      case "rm":
        await runDelete(positional[1], nonInteractive, force);
        break;

      case "search":
        await runSearch(positional[1], nonInteractive);
        break;

      case "create":
        await runCreate(positional[1]);
        break;

      case "auth":
        await runAuth(positional[1], positional[2]);
        break;

      case "shell-init":
        await runShellInit();
        break;

      default:
        console.error(red(`Unknown command: ${command}`));
        console.error("Run 'prj help' for usage information.");
        process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(red(`Error: ${error.message}`));
    } else {
      console.error(red("An unexpected error occurred"));
    }
    process.exit(1);
  }
}

main();
