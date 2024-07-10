import * as path from "path";
import * as fs from "fs/promises";

import * as core from "@actions/core";
import * as cache from "@actions/cache";
import { cacheKeyGen } from "./cache-key";

async function save() {
  const savedUnits = new Set<string>();

  const storeDirectory = core.getState("storeDirectory");
  core.debug(`Saved storeDirectory: ${storeDirectory}`);

  const restoredUnitIdsStr = core.getState("restoredUnitIdsStr");
  const restoredUnitIds = new Set(restoredUnitIdsStr?.split(" ") || []);
  core.debug(`Saved restored unit ids: ${restoredUnitIdsStr}`);

  const compilerId = core.getState("compilerId");
  core.debug(`Saved compilerId: ${compilerId}`);

  const extraCacheKey = core.getInput("extra-cache-key", { required: false });
  const cacheKey = cacheKeyGen(compilerId, extraCacheKey);

  core.startGroup("Saving cache ...");

  const dir = await fs.opendir(storeDirectory);

  for await (const direnv of dir) {
    // Skip non-unit directories
    if (
      !direnv.isDirectory() ||
      direnv.name == "incoming" ||
      direnv.name == "package.db"
    ) {
      continue;
    }

    const unitId = direnv.name;

    // Skip already cached units
    if (restoredUnitIds.has(unitId)) {
      core.debug(`Skipping already cached unit ${unitId}`);
      continue;
    }

    const key = cacheKey(unitId);
    const paths = [
      path.join(storeDirectory, unitId),
      path.join(storeDirectory, "package.db", `${unitId}.conf`),
    ];

    core.debug(`Caching paths ${paths} with key: ${key}`);
    await cache.saveCache(paths, key);
    savedUnits.add(unitId);
    console.log(`Unit ${unitId} stored in cache`);
  }

  core.endGroup();
  console.log(`Cached ${savedUnits.size} new units`);
}

save();
