import { mainWrapper } from "./wrapper.js";
import * as core from "@actions/core";
import * as cache from "@actions/cache";
import { STATE_RESTORED_UNIT_IDS } from "./constants.js";

async function restore() {
  try {
    // We need to remember the list of units we have restored from the cache so we do not try to cache them again later.
    const restoredUnitIds: string[] = [];

    core.startGroup("Restoring cache ...");
    await mainWrapper(async (_plan, unit, paths, epoch) => {
      const key = `cabal-cache-${epoch}-${unit.id}`;
      const restoredKey = await cache.restoreCache(paths, key);
      if (restoredKey) {
        console.log(`Unit ${unit.id} restored from cache`);
        restoredUnitIds.push(unit.id);
      } else {
        console.log(`Unit ${unit.id} not found in cache`);
      }
    });
    core.endGroup();
    console.log(`Restored ${restoredUnitIds.length} units from cache`);

    // non-string values are serialised with JSON.stringify. Being restoredUnits is a simple list of strings, I feel it's simpler and safer to join them with spaces.
    const restoredUnitsStr = restoredUnitIds.join(" ");
    core.saveState(STATE_RESTORED_UNIT_IDS, restoredUnitsStr);
    core.debug(`Saved restored units: ${restoredUnitsStr}`);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

restore();
