import * as path from "path";
import { getInput } from "@actions/core";

export function cacheKey(compilerId: string, unitId: string): string {
  const cacheKeyPrefix = getInput("cache-key-prefix");
  return `${cacheKeyPrefix}-${compilerId}-${unitId}`;
}

// The paths of a unit in the store. Units without a library (e.g. those of
// executables) have no package.db entry, but the list must not depend on
// that: the cache version is computed from it, so save and restore have to
// use exactly the same paths.
export function unitPaths(storeDirectory: string, unitId: string): string[] {
  return [
    path.join(storeDirectory, unitId),
    path.join(storeDirectory, "package.db", `${unitId}.conf`),
  ];
}
