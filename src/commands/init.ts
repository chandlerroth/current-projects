import {
  createProjectsDir,
  projectsDirExists,
} from "../lib/config.ts";
import { green } from "../lib/colors.ts";
import { projectsDir } from "../lib/paths.ts";

export async function runInit(nonInteractive = false): Promise<void> {
  const root = projectsDir();
  const existed = await projectsDirExists();
  if (!existed) {
    await createProjectsDir();
  }

  if (nonInteractive) {
    console.log(JSON.stringify({ success: true, created: !existed, path: root }, null, 2));
    return;
  }

  if (existed) {
    console.log(`${root} already exists`);
  } else {
    console.log(green(`Created ${root}`));
  }
  console.log(green("\nInitialization complete!"));
  console.log("Add repos with 'prj add <repo>' or 'prj create <name>'.");
}
