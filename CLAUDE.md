# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A JavaScript GitHub Action (TypeScript source, ESM, `node24` runtime) that caches a
cabal store with per-unit granularity: every global unit in cabal's `plan.json`
gets its own entry in the GitHub Actions cache. `action.yml` runs
`dist/restore.js` as the main step and `dist/save.js` as the post step.

## Commands

```sh
npm ci --ignore-scripts   # install (as CI does)
npm run build             # rolldown bundles src/restore.ts and src/save.ts into dist/
npm run format            # prettier --write
npm run format-check      # what CI runs
```

- `dist/` is the code the action runs, but it is ignored and never committed
  to `main`. It only exists on release commits (see Releases). CI and the
  integration tests build it before using the action.
- `rolldown.config.ts` builds each entry point into one self-contained ESM
  file: rolldown bundles every dependency by default, and
  `codeSplitting: false` prevents shared chunks. `package.json` has
  `"type": "module"`, which is what makes Node load `dist/*.js` as ESM.
- rolldown does no type checking; run `npx tsc --noEmit` (`tsconfig.json` is
  check-only). There is no typecheck or lint script, and no ESLint config,
  even though `eslint` is in devDependencies.
- The `lefthook.yml` pre-commit hook only runs prettier, and only for git. It
  does not run on `jj commit`, so run `npm run format` by hand.

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
  builds the action and uses it via `uses: ./cabal-cache-native`. The job has
  `continue-on-error: true`, so failures don't fail the workflow.

## Architecture

The two entry points are separate processes. They share data only through
`core.saveState` / `core.getState`: `restore` saves `compilerId`,
`storeDirectory` and `unitsToCache` (a JSON array), and `save` reads them.

**Restore** (`src/restore.ts`):

1. `plan.ts`: read `plan.json` from `project-path`/`plan-json`. The user must
   run `cabal build --dry-run` first.
2. `cabal.ts`: run
   `cabal path --output-format=json --compiler-info --store-dir` in the
   project directory, so that it picks up the same project config as the
   build. The `store-path` and `ghc` inputs become
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

Releases are cut by hand with the `Release` workflow (`release.yml`,
`workflow_dispatch` on `main`, input `version` such as `1.2.3`). It builds
`dist/`, commits it on a commit that is not on `main`, tags that commit
`vX.Y.Z`, force-moves the major tag `vX` to it, and creates the GitHub release
with generated notes. Users reference `@vX` or `@vX.Y.Z`; `@main` and commit
SHAs on `main` don't work, because `main` has no `dist/`.

There is no release-please: it uses the commit of the latest release tag as its
changelog boundary, so it can't work with release tags that are not on `main`.
