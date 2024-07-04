import { mainWrapper } from "./wrapper.js";
import * as core from "@actions/core";
import * as cache from "@actions/cache";

async function save() {
  try {
    let numberSavedUnits = 0;

    const restoredUnitIdsStr = core.getState("restoredUnitIdsStr");
    const restoredUnitIds = restoredUnitIdsStr
      ? restoredUnitIdsStr.split(" ")
      : null;

    core.startGroup("Saving cache ...");
    await mainWrapper(async (_plan, unit, paths, epoch) => {
      try {
        // NOTE: Cache entries are immutable so we should not save again
        // an entry with a key that already exists. Therefore we cache the
        // unit if:
        // 1. we do not have a list of restored units, or
        // 2. we have a list of restored units, but the unit is not in the list.
        if (restoredUnitIds == null || restoredUnitIds.indexOf(unit.id) != -1) {
          const cacheKey = `cabal-cache-${epoch}-${unit.id}`;
          await cache.saveCache(paths, cacheKey);
          console.log(`Unit ${unit.id} stored in cache`);
          numberSavedUnits += 1;
        } else {
          console.log(`Skipping already cached unit ${unit.id}`);
        }
      } catch (e) {
        core.error(`Caught an exception while caching unit ${unit.id}: ${e}`);
      }
    });
    core.endGroup();
    console.log(`Cached ${numberSavedUnits} new units`);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

save();
