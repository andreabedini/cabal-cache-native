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

  // try to find the compiler
  const ghcPath = (await io.which(compilerId, false)) || "ghc";
  core.debug(`ghcPath: ${ghcPath}`);

  const storeDirectory = await getStoreDirectory(ghcPath, cabalVersion);
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
      console.log(`Unit ${unitId} restored from cache`);
      numberOfRestoredUnits++;
    } else {
      console.log(`Unit ${unitId} was not found in cache`);
      unitsToCache.add(unitId);
    }
  }
  core.endGroup();

  console.log(`Restored ${numberOfRestoredUnits} units from cache`);

  // Non-string values are serialised with JSON.stringify. It does not seem
  // to work for Set. Being restoredUnits is a simple set of strings, it's
  // simpler and safer to make my own trivial serialisation.
  const unitsToCacheStr = Array.from(unitsToCache).join(" ");
  core.saveState("unitsToCacheStr", unitsToCacheStr);

  const packageDbPath = path.join(storeDirectory, "package.db");
  // Make sure the directory exists before running ghc-pkg
  await io.mkdirP(packageDbPath);
  await exec("ghc-pkg", ["recache", `--package-db=${packageDbPath}`]);
}

restore();
