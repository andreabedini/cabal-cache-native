import { defineConfig } from "rolldown";

// The action runs dist/restore.js and dist/save.js straight from the
// repository, so each one must be a single self-contained file: every
// dependency is bundled (rolldown's default) and nothing is split into chunks.
const entry = (name: string) =>
  defineConfig({
    input: { [name]: `src/${name}.ts` },
    platform: "node",
    transform: { target: "node24" },
    output: {
      dir: "dist",
      format: "esm",
      entryFileNames: "[name].js",
      codeSplitting: false,
      minify: true,
    },
  });

export default [entry("restore"), entry("save")];
