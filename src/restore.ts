import * as path from "path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as cache from "@actions/cache";
import { exec } from "./exec.js";
import { cacheKeyGen } from "./cache-key.js";
import { getPlan } from "./plan.js";
import { getStoreDirectory } from "./store.js";

export async function restore() {
  const plan = await getPlan();

  const compilerId = plan["compiler-id"];
  core.saveState("compilerId", compilerId);

  const cabalVersion = plan["cabal-version"];

  const storeDirectory = await getStoreDirectory(compilerId, cabalVersion);
  core.saveState("storeDirectory", storeDirectory);
  core.debug(`storeDirectory: ${storeDirectory}`);

  const extraCacheKey = core.getInput("extra-cache-key", { required: false });

  let numberOfRestoredUnits = 0;
  // We will make a list of units in the plan that are not found in the cache. These will
  // be the units to cache in the post action.
  const unitsToCache = new Set<string>();

  const myCacheKey = cacheKeyGen(compilerId, extraCacheKey);

  core.startGroup("Restoring cache ...");
  for (const { id: unitId, style: unitStyle } of plan["install-plan"]) {
    if (unitStyle != "global") {
      continue;
    }

    const key = myCacheKey(unitId);
    const paths = [
      path.join(storeDirectory, unitId),
      path.join(storeDirectory, "package.db", `${unitId}.conf`),
    ];

    core.debug(`Restoring paths ${paths} with key: ${key}`);
    const restoredKey = await cache.restoreCache(paths, key);

    if (restoredKey) {
      core.info(`Unit ${unitId} restored from cache`);
      numberOfRestoredUnits++;
    } else {
      core.info(`Unit ${unitId} was not found in cache`);
      unitsToCache.add(unitId);
    }
  }
  core.endGroup();

  core.info(`Restored ${numberOfRestoredUnits} units from cache`);

  // Only enumerable own properties are visited. This means Map, Set, etc. will become "{}".
  core.saveState("unitsToCache", JSON.stringify(Array.from(unitsToCache)));

  const packageDbPath = path.join(storeDirectory, "package.db");
  // Make sure the directory exists before running ghc-pkg
  await io.mkdirP(packageDbPath);
  await exec("ghc-pkg", ["recache", `--package-db=${packageDbPath}`]);
}

try {
  restore();
} catch (error) {
  core.setFailed(`Action failed with error: ${error.message}`);
}
