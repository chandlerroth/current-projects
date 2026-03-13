import { runInit } from "./commands/init.ts";
import { runAdd } from "./commands/add.ts";
import { runList } from "./commands/list.ts";
import { runDelete } from "./commands/delete.ts";
import { runCreate } from "./commands/create.ts";
import { runSearch } from "./commands/search.ts";
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
  help                Show this help message

Flags:
  --non-interactive   Disable interactive prompts (list prints status, rm requires index)

Examples:
  prj init
  prj add user/repo
  prj add
  prj create my-app
  prj list
  prj list --non-interactive
  prj search
  prj search prj
  prj search --non-interactive
  prj rm
  prj rm 1
`;

async function main() {
  const args = Bun.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  // Handle --help/-h on any subcommand (e.g. `prj create --help`)
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  const nonInteractive = args.includes("--non-interactive");
  // Strip flags from positional args
  const positional = args.filter((a) => !a.startsWith("--"));

  try {
    switch (command) {
      case "init":
        await runInit();
        break;

      case "add":
      case "a":
        await runAdd(positional[1]);
        break;

      case "list":
      case "l":
        await runList(nonInteractive);
        break;

      case "rm":
        await runDelete(positional[1], nonInteractive);
        break;

      case "search":
      case "s":
        await runSearch(positional[1], nonInteractive);
        break;

      case "create":
      case "c":
        await runCreate(positional[1]);
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
