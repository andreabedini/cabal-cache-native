import * as core from "@actions/core";
import * as fs from "fs/promises";
import * as path from "path";

export interface Unit {
  id: string;
  style: string | undefined;
}

interface Plan {
  "compiler-id": string;
  "install-plan": Unit[];
}

async function readPlanJson(planPath: string): Promise<Plan> {
  try {
    const file = await fs.readFile(planPath);
    return JSON.parse(file.toString());
  } catch (e) {
    const msg = (e as Error).message;
    throw Error(
      `Failed to read build plan from ${planPath}. Perhaps you forgot to run 'cabal build --dry-run?' Exception: ${msg}`,
    );
  }
}

export async function getPlan(): Promise<Plan> {
  const planJson = core.getInput("plan-json");
  const projectPath = core.getInput("project-path");

  const resolvedPath = path.resolve(projectPath, planJson);
  core.info(`Reading the build plan from ${resolvedPath}`);

  return await readPlanJson(resolvedPath);
}
