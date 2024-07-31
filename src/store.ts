import * as path from "path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import { execWithOutput } from "./exec.js";

async function getGhcInfo(ghcPath: string) {
  const myOutput = await execWithOutput(ghcPath, ["--info"]);
  const re = /\("([^"]*)","([^"]*)"\)/g;
  const info = {};
  let result: RegExpExecArray | null;
  while ((result = re.exec(myOutput))) {
    const key = result[1];
    const value = result[2];
    info[key] = value;
  }
  return info;
}

function versionAtLeast(ver1: string, ver2: string) {
  return ver1.localeCompare(ver2, undefined, { numeric: true }) >= 0;
}

async function findGhc(planCompilerId: string) {
  let path = core.getInput("ghc-path", { required: false });
  if (path) {
    core.debug(`using user provided path ${path}`);
    return path;
  }

  // try to find the compiler with "compiler-id" as in the plan
  core.debug(`planCompilerId: ${planCompilerId}`);
  path = await io.which(planCompilerId, false);
  if (path) {
    return path;
  }
  core.debug(`${planCompilerId} not found in PATH`);

  // try our luck with just "ghc"
  path = await io.which("ghc", false);
  if (path) {
    return path;
  }
  core.debug("ghc not found in PATH");

  throw new Error(
    `Compiler ${planCompilerId} not found. Please specify the correct path to GHC.`,
  );
}

export async function getStoreDirectory(
  planCompilerId: string,
  cabalVersion: string,
) {
  // try to find the compiler
  const ghcPath = await findGhc(planCompilerId);
  core.debug(`using ${ghcPath}`);

  // Slight approximations but they only have to work on a finite number of cases.
  const info = await getGhcInfo(ghcPath);
  const compilerId = `ghc-${info["Project version"]}`;
  const compilerAbiTag = info["Project Unit Id"];

  if (planCompilerId != compilerId) {
    throw new Error(
      `The only compiler I could find is ${compilerId} at ${ghcPath} but cabal's plan is for ${planCompilerId}. Please specify the correct path to GHC.`,
    );
  }

  // NOTE: Cabal-install calls this "store root", which contains a separate store directory for each compiler.
  const storeRoot = core.getInput("store-path", { required: true });

  const storeDirectory = versionAtLeast(cabalVersion, "3.12")
    ? path.join(storeRoot, compilerAbiTag || compilerId)
    : path.join(storeRoot, compilerId);

  return storeDirectory;
}
