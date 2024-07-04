export function cacheKey(
  compilerId: string,
  cacheKeyPrefix: string,
  unitId: string,
): string {
  return `${cacheKeyPrefix}-${compilerId}-${unitId}`;
}
