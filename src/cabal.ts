import * as path from "path";
import * as core from "@actions/core";
import { execWithOutput } from "./exec.js";

// The output of `cabal path --output-format=json --compiler-info --store-dir`.
export interface CabalPath {
  "cabal-version": string;
  "store-dir": string;
  compiler: {
    flavour: string;
    id: string;
    path: string;
    // Only reported by cabal-install 3.16 and later.
    "abi-tag"?: string;
    "store-path"?: string;
  };
}

// Asks cabal where the project's compiler and store are. It runs in the
// project directory so that cabal takes the project configuration (e.g.
// `with-compiler`) into account, just like `cabal build` does.
export async function cabalPath(): Promise<CabalPath> {
  const cabal = core.getInput("cabal") || "cabal";
  const projectPath = path.resolve(core.getInput("project-path"));
  const storePath = core.getInput("store-path");
  const ghc = core.getInput("ghc");

  const args: string[] = [];
  if (storePath) {
    // --store-dir is a global flag, so it goes before the command.
    args.push(`--store-dir=${storePath}`);
  }
  args.push("path", "--output-format=json", "--compiler-info", "--store-dir");
  if (ghc) {
    args.push(`--with-compiler=${ghc}`);
  }

  let output: string;
  try {
    output = await execWithOutput(cabal, args, { cwd: projectPath });
  } catch (e) {
    throw Error(
      `Failed to query cabal for the store location. cabal-cache-native requires cabal-install 3.12 or later. ${(e as Error).message}`,
    );
  }
  core.debug(`cabal path: ${output}`);
  return JSON.parse(output);
}
