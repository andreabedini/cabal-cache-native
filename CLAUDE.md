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

- `test-workflow.yml` runs `test-build.yml` twice in sequence with the same
  `cache-key-prefix` (unique per run). `step-one` fills the cache and
  `step-two` should restore from it.
- `test-build.yml` creates a throwaway project that builds one Hackage package
  (`lens`) at a pinned `index-state`. It runs on ubuntu, macOS and Windows and
  uses the action via `uses: ./cabal-cache-native`.
- Only cabal 3.12 is tested. The cabal 3.10 job is commented out.

## Architecture

The two entry points are separate processes. They share data only through
`core.saveState` / `core.getState`: `restore` saves `compilerId`,
`storeDirectory` and `unitsToCache` (a JSON array), and `save` reads them.

**Restore** (`src/restore.ts`):

1. `plan.ts`: read `plan.json` from `project-path`/`plan-json`. The user must
   run `cabal build --dry-run` first.
2. `ghc.ts`: find `ghc` (the `ghc` input, or the plan's `compiler-id` on
   `PATH`) and parse `ghc --info`. `ghc-pkg` is found by replacing `ghc` with
   `ghc-pkg` in the path.
3. `store.ts`: work out the store directory under `store-path`. With
   cabal ≥ 3.12 it is the GHC ABI tag (`Project Unit Id`); with older cabal it
   is `ghc-<version>`.
4. `plan.ts` `traverse`: depth-first walk of the global units, dependencies
   first. If a dependency failed or was skipped, its dependents are marked
   skipped and are not looked up. Skipped and failed units become
   `unitsToCache`.
5. Run `ghc-pkg recache` on `<store>/package.db` if anything was restored.

**Save** (`src/save.ts`): for each unit in `unitsToCache`, check that both
paths exist, then call `cache.saveCache`. A unit that cabal did not build is
skipped.

The two paths per unit are `<store>/<unitId>` and
`<store>/package.db/<unitId>.conf`. The cache key is
`<cache-key-prefix>-<compiler-id>-<unitId>` (`src/cache-key.ts`). `restore.ts`
and `save.ts` must build the same paths and keys.

## Gotchas

- `action.yml` declares the input as `ghcPkg`, but `ghc.ts` and the README use
  `ghc-pkg`. Check both places when you change inputs.
- `plan["cabal-version"]` is read in `restore.ts` but is missing from the
  `Plan` type.

## Releases

release-please (`release-please-config.json`, node release type, prerelease)
creates releases from Conventional Commit messages. `build.yml` is a manual
(`workflow_dispatch`) workflow that rebuilds `dist/` and pushes the result.
