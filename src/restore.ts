import * as path from "path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as cache from "@actions/cache";
import { exec } from "./exec.js";
import { cacheKey, unitPaths } from "./cache-key.js";
import { getPlan, toAdjacencyList, traverse } from "./plan.js";
import { cabalPath } from "./cabal.js";
import { getStoreDirectory } from "./store.js";
import { ghcPkgPath } from "./ghc.js";

export async function restore() {
  const plan = await getPlan();
  const compilerId = plan["compiler-id"];

  const cabal = await cabalPath();
  if (cabal.compiler.id !== compilerId) {
    throw Error(
      `The build plan uses ${compilerId} but cabal path reports ${cabal.compiler.id}. Make sure the ghc input matches the compiler used to create the build plan.`,
    );
  }

  const storeDirectory = await getStoreDirectory(cabal);
  core.info(`Store directory: ${storeDirectory}`);

  core.saveState("compilerId", compilerId);
  core.saveState("storeDirectory", storeDirectory);

  core.startGroup("Restoring cache ...");

  const adjList = toAdjacencyList(
    plan["install-plan"].filter((v) => v.style == "global"),
  );

  const { completed, skipped, failed } = await traverse(
    adjList,
    async (unitId) => {
      const key = cacheKey(compilerId, unitId);
      const paths = unitPaths(storeDirectory, unitId);

      core.debug(`Restoring paths ${paths} with key: ${key}`);
      try {
        const restoredKey = await cache.restoreCache(paths, key);
        if (!restoredKey) {
          core.info(`Unit ${unitId} was not found in cache`);
          return false;
        }
        core.info(`Unit ${unitId} restored from cache`);
        return true;
      } catch (e) {
        core.warning(`Error restoring ${unitId}: ${e}`);
        return false;
      }
    },
  );
  core.endGroup();

  core.debug(`Completed: ${[...completed].join(", ")}`);
  core.debug(`Skipped: ${[...skipped].join(", ")}`);
  core.debug(`Failed: ${[...failed].join(", ")}`);

  const unitsToCache = [...skipped, ...failed];
  core.saveState("unitsToCache", JSON.stringify(unitsToCache));

  core.info(`${completed.size} units have been restored from cache`);
  core.info(
    `${unitsToCache.length} units are marked to be saved at the end of the workflow.`,
  );
  core.setOutput("restored", completed.size);
  core.setOutput("missed", unitsToCache.length);

  if (completed.size > 0) {
    const ghcPkg = core.getInput("ghc-pkg") || ghcPkgPath(cabal.compiler.path);
    const packageDbPath = path.join(storeDirectory, "package.db");
    // Make sure the directory exists, as we might have restored only units without a library.
    await io.mkdirP(packageDbPath);
    await exec(ghcPkg, ["recache", `--package-db=${packageDbPath}`]);
  }
}

restore().catch((e) => core.setFailed((e as Error).message));
