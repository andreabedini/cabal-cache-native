import * as path from "path";

import * as core from "@actions/core";
import * as cache from "@actions/cache";
import { cacheKeyGen } from "./cache-key";

async function save() {
  const storeDirectory = core.getState("storeDirectory");
  core.debug(`Saved storeDirectory: ${storeDirectory}`);

  const compilerId = core.getState("compilerId");
  core.debug(`Saved compilerId: ${compilerId}`);

  const extraCacheKey = core.getInput("extra-cache-key", { required: false });
  const mkCacheKey = cacheKeyGen(compilerId, extraCacheKey);

  const unitsToCacheStr = core.getState("unitsToCacheStr");
  const unitsToCache = new Set(unitsToCacheStr?.split(" ") || []);
  core.debug(`Units to cache: ${unitsToCacheStr}`);

  if (unitsToCache.size === 0) {
    core.info("No units to cache, stopping here");
  } else {
    let numberOfSavedUnits = 0;
    const unitsFailedToCache = new Set<string>();
    core.startGroup("Saving cache ...");
    for await (const unitId of unitsToCache) {
      const key = mkCacheKey(unitId);
      const paths = [
        path.join(storeDirectory, unitId),
        path.join(storeDirectory, "package.db", `${unitId}.conf`),
      ];

      core.debug(`Caching paths ${paths} with key: ${key}`);
      try {
        await cache.saveCache(paths, key);
      } catch (e) {
        console.error(`Error saving ${unitId}: ${e}`);
        unitsFailedToCache.add(unitId);
        continue;
      }
      console.log(`Unit ${unitId} stored in cache`);
      numberOfSavedUnits++;
    }
    core.endGroup();

    if (numberOfSavedUnits > 0) {
      core.info(`Cached ${numberOfSavedUnits} new units`);
    } else {
      core.info("No new units were cached.");
    }
    if (unitsFailedToCache.size > 0) {
      console.log(
        `Failed to cache ${unitsFailedToCache.size} units: ${Array.from(unitsFailedToCache).join(", ")}`,
      );
    }
  }
}

save();
