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

  const unitsToCache = JSON.parse(core.getState("unitsToCache"));
  if (!(unitsToCache instanceof Array)) {
    throw Error(`unitsToCache is not an array: ${unitsToCache}`);
  }

  if (unitsToCache.length === 0) {
    core.info("No units to cache, stopping here");
  } else {
    core.info(`${unitsToCache.length} units have been marked to save.`);
    core.debug(`Units to cache: ${unitsToCache.join(", ")}`);

    core.startGroup("Saving ...");
    let numberOfSavedUnits = 0;
    const unitsFailedToCache = new Set<string>();
    for await (const unitId of unitsToCache) {
      const key = cacheKey(compilerId, unitId);

      const paths = [
        path.join(storeDirectory, unitId),
        path.join(storeDirectory, "package.db", `${unitId}.conf`),
      ];

      core.info(`Unit ${unitId} (key: ${key})`);
      let allok = true;
      for (const p of paths) {
        const exists = await fs.stat(p).then(
          (_) => true,
          (_) => false,
        );
        core.info(`- ${p} ${exists ? "exists" : "does not exist"}`);
        allok = allok && exists;
      }
      if (!allok) {
        core.info("Some paths do not exist, skipping");
        continue;
      }

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
