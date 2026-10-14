# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A JavaScript GitHub Action (TypeScript source, `node20` runtime) that caches a
cabal store with per-unit granularity: every global unit in cabal's `plan.json`
gets its own entry in the GitHub Actions cache. `action.yml` runs
`dist/restore.js` as the main step and `dist/save.js` as the post step.

## Commands

```sh
npm ci --ignore-scripts   # install (as CI does)
npm run build             # esbuild bundles src/restore.ts and src/save.ts into dist/
npm run format            # prettier --write
npm run format-check      # what CI runs
```

- `dist/` is committed and is the code the action runs. CI rebuilds it and
  fails if `git diff ./dist` is not empty, so rebuild and commit `dist/` with
  every change to `src/`.
- esbuild does no type checking. There is no typecheck or lint script, and no
  ESLint config, even though `typescript` and `eslint` are in devDependencies.
- The `lefthook.yml` pre-commit hook (format, build, `git add dist`) is a git
  hook. It does not run on `jj commit`, so run `npm run format` and
  `npm run build` by hand first.

## Tests

There are no unit tests. The integration tests are GitHub workflows that only
run on GitHub (`ci.yml` → `tests.yml` → `test-workflow.yml` → `test-build.yml`):

- `tests.yml` runs one job per cabal version: 3.12, which uses the store
  fallback in `store.ts`, and 3.16, which reports the store path itself.
- `test-workflow.yml` runs `test-build.yml` twice in sequence with the same
  `cache-key-prefix` (unique per run and cabal version). `step-one` fills the
  cache. `step-two` passes `expect-restored`, which checks the action's
  `restored`/`missed` outputs and that `cabal build --dry-run` has nothing left
  to build.
- `test-build.yml` creates a throwaway project that builds one Hackage package
  (`lens`) at a pinned `index-state`. It runs on ubuntu, macOS and Windows and
  uses the action via `uses: ./cabal-cache-native`. The job has
  `continue-on-error: true`, so failures don't fail the workflow.

## Architecture

The two entry points are separate processes. They share data only through
`core.saveState` / `core.getState`: `restore` saves `compilerId`,
`storeDirectory` and `unitsToCache` (a JSON array), and `save` reads them.

**Restore** (`src/restore.ts`):

1. `plan.ts`: read `plan.json` from `project-path`/`plan-json`. The user must
   run `cabal build --dry-run` first.
2. `cabal.ts`: run `cabal path --output-format=json --compiler-info
--store-dir` in the project directory, so that it picks up the same
   project config as the build. The `store-path` and `ghc` inputs become
   `--store-dir` and `--with-compiler`. Fail if its compiler id differs from
   the plan's `compiler-id`. This needs cabal-install 3.12 or later.
3. `store.ts`: cabal ≥ 3.16 reports `compiler.store-path` directly. For 3.12
   and 3.14, join `store-dir` with GHC's `Project Unit Id` from
   `ghc --info`, or the compiler id when it has none (GHC < 9.8).
4. `plan.ts`: `toAdjacencyList` keeps only global units, and only their
   dependencies on other global units. Pre-existing units such as `base` are
   never looked up. It collects `depends` and `exe-depends`, including
   per-component ones. `traverse` then visits each unit once, dependencies
   first. If a dependency failed or was skipped, the unit is skipped without
   a lookup. Skipped and failed units become `unitsToCache`.
5. Run `ghc-pkg recache` on `<store>/package.db` if anything was restored.
   `ghc-pkg` is derived from the file name of the compiler path
   (`ghc.ts` `ghcPkgPath`).

**Save** (`src/save.ts`): for each unit in `unitsToCache`, check that the unit
directory exists (a unit that cabal did not build is skipped), then call
`cache.saveCache`. Errors only produce warnings, so the job doesn't fail.

`unitPaths` in `src/cache-key.ts` gives the two paths per unit:
`<store>/<unitId>` and `<store>/package.db/<unitId>.conf`. Units without a
library (e.g. `happy-2.2-e-happy-…`) have no `.conf`. Both paths are still
passed to `@actions/cache`, because it hashes the path list into the cache
version, so save and restore must pass identical lists. The cache key is
`<cache-key-prefix>-<compiler-id>-<unitId>`.

`@actions/cache` `saveCache` returns `-1` instead of throwing for most
failures. `restoreCache` returns `undefined` on a miss.

## Releases

release-please (`release-please-config.json`, node release type, prerelease)
creates releases from Conventional Commit messages. `build.yml` is a manual
(`workflow_dispatch`) workflow that rebuilds `dist/` and pushes the result.
