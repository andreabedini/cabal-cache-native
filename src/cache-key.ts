import { getInput } from "@actions/core";

export function cacheKey(compilerId: string, unitId: string): string {
  const cacheKeyPrefix = getInput("cache-key-prefix");
  return `${cacheKeyPrefix}-${compilerId}-${unitId}`;
}
