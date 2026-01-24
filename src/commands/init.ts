import {
  configExists,
  createConfig,
  createProjectsDir,
  projectsDirExists,
} from "../lib/config.ts";
import { green } from "../lib/colors.ts";
import { PROJECTS_DIR, CONFIG_FILE } from "../lib/paths.ts";

export async function runInit(): Promise<void> {
  // Create projects directory if it doesn't exist
  if (!(await projectsDirExists())) {
    await createProjectsDir();
    console.log(green(`Created ${PROJECTS_DIR}`));
  } else {
    console.log(`${PROJECTS_DIR} already exists`);
  }

  // Create config file if it doesn't exist
  if (!(await configExists())) {
    await createConfig();
    console.log(green(`Created ${CONFIG_FILE}`));
  } else {
    console.log(`${CONFIG_FILE} already exists`);
  }

  console.log(green("\nInitialization complete!"));
  console.log(`Add repos to ${CONFIG_FILE} and run 'prj install' to clone them.`);
}
