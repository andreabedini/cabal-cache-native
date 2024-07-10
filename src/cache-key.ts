export function cacheKeyGen(
  compilerId: string,
  extraCacheKey: string | undefined,
) {
  return (unitId: string) =>
    [
      "cabal",
      extraCacheKey ? `-${extraCacheKey}` : "",
      `-${compilerId}-${unitId}`,
    ].join("");
}
