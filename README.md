# cabal-cache-native

A GitHub Action that caches the dependencies of a Haskell cabal project one
unit at a time, using GitHub's own cache. A change to one dependency only
invalidates that dependency and what depends on it; everything else is
restored as before.

## Usage

Requirements:

- cabal-install 3.12 or later.
- A runner that can run Node 24 actions (all GitHub-hosted runners can).

Create the build plan with `--dry-run`, run the action, then build as usual:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: haskell-actions/setup@v2

      # Creates dist-newstyle/cache/plan.json, which the action reads.
      - run: cabal build all --dry-run

      - uses: andreabedini/cabal-cache-native@v1

      - run: cabal build all
```

Run the `--dry-run` with exactly the same targets and flags as the real build
(for example `--enable-tests`). If they differ, the build still works, but
units that only the real build needs are neither restored nor saved, so cabal
rebuilds them every time.

Reference the action by a release tag, `@v1` or `@v1.2.3`. The `main` branch
holds only the source; the built action exists only on release tags.

## Inputs

| Input              | Default                         | Description                                                                                             |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `project-path`     | `.`                             | Path to the cabal project. `cabal path` runs here, so it sees the project's configuration.              |
| `plan-json`        | `dist-newstyle/cache/plan.json` | Path to the build plan, relative to `project-path`.                                                     |
| `cache-key-prefix` | `cabal`                         | Prefix for every cache key. Change it to separate caches or to start from scratch.                      |
| `store-path`       | the store cabal uses            | Path to the cabal store, passed to cabal as `--store-dir`. It must be the store your build uses.        |
| `cabal`            | `cabal`                         | Path to cabal.                                                                                          |
| `ghc`              | the project's compiler          | Path to ghc, passed to cabal as `--with-compiler`. It must be the compiler that created the build plan. |
| `ghc-pkg`          | the `ghc-pkg` next to ghc       | Path to ghc-pkg, used to update the store's package database after a restore.                           |

## Outputs

| Output     | Description                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `restored` | Number of units restored from the cache.                                                       |
| `missed`   | Number of units not restored. They are saved at the end of the job, once cabal has built them. |

## How it works

cabal installs dependencies into a shared "store", where each unit (a library,
executable or sublibrary of a package) has an id that is a hash of everything
that went into building it. Caching the whole store under one key, as the
[model workflow of haskell-actions/setup](https://github.com/haskell-actions/setup/blob/main/docs/examples.md)
does, is all or nothing: when the plan changes, the job either restores an
older store with entries it no longer needs, or starts from nothing. Keying
each unit by its own id avoids that, and lets GitHub expire units that are no
longer used one by one.

The action runs in two steps:

1. **Restore**, where the action appears in the job. It reads `plan.json`, and
   asks `cabal path` where the store is and which compiler the project uses;
   it fails if that compiler is not the one in the plan. Then it restores the
   plan's store units, dependencies first. If a unit is not in the cache, the
   units that depend on it are not restored either, because cabal rebuilds the
   missing unit, and the cached dependents were built against a different copy
   of it. Finally it runs `ghc-pkg recache` on the store's package database.
2. **Save**, at the end of the job. Every unit that was not restored, and that
   cabal has since built, is saved as its own cache entry.

## Limitations

- **One cache entry per unit.** A large project has a few hundred store units,
  and GitHub limits each repository to 200 cache uploads and 1500 downloads per
  minute. A job that starts from an empty cache, especially in a large build
  matrix, can exceed the upload limit. Units that fail to save are rebuilt and
  saved by later runs.
- **Cache scope.** As with any GitHub cache, a run can only restore entries
  created on its own branch or the default branch, so a pull request starts
  from what the default branch has cached.
- **Storage.** Each repository has 10 GB of cache storage before extra usage
  is billed, and entries not used for 7 days are removed.
- **Only the store.** Local packages and `dist-newstyle` are not cached.
- **Units are restored one at a time**, so restoring a few hundred units takes
  a few hundred requests.

See [GitHub's documentation on dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
for the current limits and scope rules.

## License

You are welcome to use this under the MIT license included in the repository.
