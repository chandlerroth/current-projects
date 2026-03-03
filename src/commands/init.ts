import {
  createProjectsDir,
  projectsDirExists,
} from "../lib/config.ts";
import { green } from "../lib/colors.ts";
import { PROJECTS_DIR } from "../lib/paths.ts";

export async function runInit(): Promise<void> {
  if (!(await projectsDirExists())) {
    await createProjectsDir();
    console.log(green(`Created ${PROJECTS_DIR}`));
  } else {
    console.log(`${PROJECTS_DIR} already exists`);
  }

  console.log(green("\nInitialization complete!"));
  console.log("Add repos with 'prj add <repo>' or 'prj create <name>'.");
}
