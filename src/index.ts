import { runInit } from "./commands/init.ts";
import { runAdd } from "./commands/add.ts";
import { runInstall } from "./commands/install.ts";
import { runStatus } from "./commands/status.ts";
import { runList } from "./commands/list.ts";
import { runCd } from "./commands/cd.ts";
import { red } from "./lib/colors.ts";

const HELP = `prj - Project Manager

Usage: prj <command> [args]

Commands:
  init              Initialize ~/Projects directory and config file
  add, a <repo>     Add a repository to config and clone it
  install, i        Clone all repositories from config
  status, s         Show git status for all repositories
  list, l           Interactive project selector
  cd <index>        Output project path by index (1-based)
  help              Show this help message

Examples:
  prj init
  prj add git@github.com:user/repo.git
  prj status
  prj list
  prj cd 1
`;

async function main() {
  const args = Bun.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  try {
    switch (command) {
      case "init":
        await runInit();
        break;

      case "add":
      case "a":
        await runAdd(args[1]);
        break;

      case "install":
      case "i":
        await runInstall();
        break;

      case "status":
      case "s":
        await runStatus();
        break;

      case "list":
      case "l":
        await runList();
        break;

      case "cd":
        await runCd(args[1]);
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
