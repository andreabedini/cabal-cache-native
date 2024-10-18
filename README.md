# cabal-cache-native

This action caches the build dependencies of a Haskell project with
per-package granularity. It works out of the box and it is really fast.

## Usage

When building a Haskell project with cabal, cabal caches the project
dependencies in a global cache called the "store". These are identified
by a key that accurately represents their build configuration so they
can be shared between projects.

Using [@actions/cache](https://github.com/actions/cache) to cache the
entire store is not optimal because it would either cache the entirety
of the store or nothing at all; which cabal does already at keeping
track of what can be shared between builds and what can't.

The complexity of the example workflow from [haskell-actions/setup](https://github.com/haskell-actions/setup/blob/ec49483bfc012387b227434aba94f59a6ecd0900/README.md#model-cabal-workflow-with-caching) is a testament to this issue.

## Features

- **Automatic**: the action detects the project's dependencies directly from cabal's build plan and caches them automatically.
- **Fast**: the cache is stored in GitHub's own cache and it is restored very quickly.
- **Accurate**: the cached packages are identified by the same package-hash used by cabal, allowing GitHub to garbage-collect them individually when they are not needed anymore.

## Usage

To use this action you need to get cabal to create a build plan (i.e. the `plan.json` file). This is typically achieved by passing the `--dry-run` flag to the build command. Once `plan.json` has been created, `cabal-cache-native` will read from it the ids of the units to restore from cache. The action will look for `plan.json` in `${project-path}/${plan-json}`.

```yaml
jobs:
  build:
    steps:
      - uses: haskell-actions/setup
        id: setup

      # ...

      # This step is required to generate the build plan
      - run: cabal build all --dry-run

      - uses: andreabedini/cabal-cache-native
        with:
          # required
          store-path: ${{ steps.setup.outputs.cabal-store }}

          # optional, the path to the project
          # project-path: .

          # optional, you can also specify the exact location of plan.json
          # plan-json: dist-newstyle/cache/plan.json

          # optional, use this to separate caches or to start from scratch.
          # cache-epoch: 0

      # No need to check for cache hits, just build your project!
      - run: cabal build all
```

NOTE: `cabal build` has to be the same command you use to build (plus
`--dry-run`) otherwise you risk caching the wrong dependencies. This should not
cause build failures, but it will cause unnecessary recompilations.

## License

You are welcome to use this under the MIT license included in the repository.
