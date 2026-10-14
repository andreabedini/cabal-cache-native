import * as fs from "fs/promises";
import * as core from "@actions/core";
import * as cache from "@actions/cache";
import { cacheKey, unitPaths } from "./cache-key.js";

async function exists(p: string): Promise<boolean> {
  return fs.stat(p).then(
    () => true,
    () => false,
  );
}

async function save() {
  const unitsToCacheState = core.getState("unitsToCache");
  if (!unitsToCacheState) {
    core.info("The restore step did not complete, nothing to save");
    return;
  }

  const storeDirectory = core.getState("storeDirectory");
  core.debug(`Saved storeDirectory: ${storeDirectory}`);

  const compilerId = core.getState("compilerId");
  core.debug(`Saved compilerId: ${compilerId}`);

  const unitsToCache = JSON.parse(unitsToCacheState);
  if (!(unitsToCache instanceof Array)) {
    throw Error(`unitsToCache is not an array: ${unitsToCache}`);
  }

  if (unitsToCache.length === 0) {
    core.info("No units to cache, stopping here");
    return;
  }

  core.info(`${unitsToCache.length} units have been marked to save.`);
  core.debug(`Units to cache: ${unitsToCache.join(", ")}`);

  core.startGroup("Saving ...");
  let numberOfSavedUnits = 0;
  const unitsNotBuilt = new Set<string>();
  const unitsFailedToCache = new Set<string>();
  for (const unitId of unitsToCache) {
    const key = cacheKey(compilerId, unitId);
    const paths = unitPaths(storeDirectory, unitId);

    // The package.db entry is missing for units without a library, so only
    // the unit directory is required.
    if (!(await exists(paths[0]))) {
      core.info(`Unit ${unitId} is not in the store, skipping`);
      unitsNotBuilt.add(unitId);
      continue;
    }

    try {
      // saveCache logs the reason and returns -1 if it fails.
      if ((await cache.saveCache(paths, key)) === -1) {
        unitsFailedToCache.add(unitId);
        continue;
      }
    } catch (e) {
      core.warning(`Error saving ${unitId}: ${e}`);
      unitsFailedToCache.add(unitId);
      continue;
    }
    core.info(`Unit ${unitId} stored in cache (key: ${key})`);
    numberOfSavedUnits++;
  }
  core.endGroup();

  if (numberOfSavedUnits > 0) {
    core.info(`Cached ${numberOfSavedUnits} new units`);
  } else {
    core.info("No new units were cached.");
  }
  if (unitsNotBuilt.size > 0) {
    core.info(
      `${unitsNotBuilt.size} units were not built, perhaps the build plan differs from the build`,
    );
  }
  if (unitsFailedToCache.size > 0) {
    core.warning(
      `Failed to cache ${unitsFailedToCache.size} units: ${Array.from(unitsFailedToCache).join(", ")}`,
    );
  }
}

// Failing to save the cache should not fail the job.
save().catch((e) => core.warning((e as Error).message));
