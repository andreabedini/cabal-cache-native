import * as path from "path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as cache from "@actions/cache";
import { exec } from "./exec.js";
import { cacheKey } from "./cache-key.js";
import { getPlan, Result, toAdjacencyList, traverse } from "./plan.js";
import { getStoreDirectory } from "./store.js";
import { findGhc } from "./ghc.js";

export async function restore() {
  const plan = await getPlan();

  const compilerId = plan["compiler-id"];
  core.saveState("compilerId", compilerId);

  const cabalVersion = plan["cabal-version"];

  const ghc = await findGhc(compilerId);
  const storeDirectory = await getStoreDirectory(ghc, cabalVersion);
  core.saveState("storeDirectory", storeDirectory);
  core.debug(`storeDirectory: ${storeDirectory}`);

  let numberOfRestoredUnits = 0;

  core.startGroup("Restoring cache ...");

  const adjList = toAdjacencyList(
    plan["install-plan"].filter((v) => v.style == "global"),
  );

  const { completed, skipped, failed } = await traverse(
    adjList,
    async (unitId) => {
      const key = cacheKey(compilerId, unitId);
      const paths = [
        path.join(storeDirectory, unitId),
        path.join(storeDirectory, "package.db", `${unitId}.conf`),
      ];

      core.debug(`Restoring paths ${paths} with key: ${key}`);
      try {
        const restoredKey = await cache.restoreCache(paths, key);
        if (!restoredKey) {
          core.info(`Unit ${unitId} was not found in cache`);
          // unitsToCache.add(unitId);
          return false;
        }
        core.info(`Unit ${unitId} restored from cache`);
        //  numberOfRestoredUnits++;
      } catch (e) {
        core.error(e);
        return false;
      }
    },
  );
  core.endGroup();

  core.info(`Completed: ${completed}`);
  core.info(`Skipped: ${skipped}`);
  core.info(`Failed: ${failed}`);

  const unitsToCache = new Set<string>([...skipped, ...failed]);

  // Only enumerable own properties are visited. This means Map, Set, etc. will become "{}".
  core.saveState("unitsToCache", JSON.stringify(Array.from(unitsToCache)));

  core.info(`${numberOfRestoredUnits} units have been restored from cache`);
  core.info(
    `${unitsToCache.size} units are marked to be saved at the end of the workflow.`,
  );

  if (completed.size > 0) {
    const packageDbPath = path.join(storeDirectory, "package.db");
    // Make sure the directory exists before running ghc-pkg, as we might have restored nothing.
    await io.mkdirP(packageDbPath);
    await exec(ghc.ghcPkgPath, ["recache", `--package-db=${packageDbPath}`]);
  }
}

restore();
