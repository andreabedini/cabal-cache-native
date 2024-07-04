import { readFile } from "fs/promises";
import * as path from "path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";

interface Plan {
  "compiler-id": string;
  "install-plan": Unit[];
}

interface Unit {
  id: string;
  style: string | undefined;
}

type Action = (
  plan: Plan,
  unit: Unit,
  paths: string[],
  epoch: string,
) => Promise<void>;

export async function mainWrapper(act: Action) {
  const planJson = core.getInput("plan-json", { required: false });
  const projectPath = core.getInput("project-path", { required: false });
  const storePath = core.getInput("store-path", { required: true });
  const cacheEpoch = core.getInput("cache-epoch", { required: false });

  core.debug(`plan-json: ${planJson}`);
  core.debug(`project-path: ${projectPath}`);
  core.debug(`store-path: ${storePath}`);
  core.debug(`cache-epoch: ${cacheEpoch}`);

  const resolvedPath = path.resolve(projectPath, planJson);
  console.log(`Reading the build plan from ${resolvedPath}`);

  let plan;
  try {
    const file = await readFile(resolvedPath);
    plan = JSON.parse(file.toString());
  } catch (e) {
    const msg = (e as Error).message;
    throw Error(
      `Failed to read build plan from ${resolvedPath}. Perhaps you forgot to run 'cabal build --dry-run?' Exception: ${msg}`,
    );
  }

  const compilerId = plan["compiler-id"];
  const packageDbPath = path.join(storePath, compilerId, "package.db");
  await io.mkdirP(packageDbPath);

  for (const unit of plan["install-plan"]) {
    if (unit.style == "global") {
      const paths = [
        path.join(storePath, compilerId, unit.id),
        path.join(storePath, compilerId, "package.db", unit.id),
      ];
      await act(plan, unit, paths, cacheEpoch);
    }
  }

  await exec.exec("ghc-pkg", ["recache", `--package-db=${packageDbPath}`]);
}
