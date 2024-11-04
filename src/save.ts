import * as fs from "fs/promises";
import * as path from "path";
import * as core from "@actions/core";
import * as cache from "@actions/cache";
import { cacheKey } from "./cache-key";

async function save() {
  const storeDirectory = core.getState("storeDirectory");
  core.debug(`Saved storeDirectory: ${storeDirectory}`);

  const compilerId = core.getState("compilerId");
  core.debug(`Saved compilerId: ${compilerId}`);

  const cacheKeyPrefix = core.getInput("cache-key-prefix");

  const unitsToCache = JSON.parse(core.getState("unitsToCache"));
  if (!(unitsToCache instanceof Array)) {
    throw Error(`unitsToCache is not an array: ${unitsToCache}`);
  }

  if (unitsToCache.length === 0) {
    core.info("No units to cache, stopping here");
  } else {
    core.startGroup("Saving cache ...");
    core.debug(`Units to cache: ${unitsToCache.join(", ")}`);

    let numberOfSavedUnits = 0;
    const unitsFailedToCache = new Set<string>();
    for await (const unitId of unitsToCache) {
      const key = cacheKey(compilerId, cacheKeyPrefix, unitId);
      const paths = [
        path.join(storeDirectory, unitId),
        path.join(storeDirectory, "package.db", `${unitId}.conf`),
      ];

      // skip caching paths that do not exists on disk, they must have failed to build.
      let paths_exist = paths.map((p) =>
        fs.stat(p).then(
          (_) => true,
          (_) => false,
        ),
      );
      if (!(await Promise.all(paths_exist))) {
        continue;
      }

      core.info(`Caching paths ${paths} with key: ${key}`);
      try {
        await cache.saveCache(paths, key);
      } catch (e) {
        core.warning(`Error saving ${unitId}: ${e}`);
        unitsFailedToCache.add(unitId);
        continue;
      }
      core.info(`Unit ${unitId} stored in cache`);
      numberOfSavedUnits++;
    }
    core.endGroup();

    if (numberOfSavedUnits > 0) {
      core.info(`Cached ${numberOfSavedUnits} new units`);
    } else {
      core.info("No new units were cached.");
    }
    if (unitsFailedToCache.size > 0) {
      core.warning(
        `Failed to cache ${unitsFailedToCache.size} units: ${Array.from(unitsFailedToCache).join(", ")}`,
      );
    }
  }
}

save();
