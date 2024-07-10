import * as path from "path";
import * as core from "@actions/core";
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

export async function getStoreDirectory(ghcPath: string, cabalVersion: string) {
  // NOTE: Cabal-install calls this "store root", which contains a separate store directory for each compiler.
  const storeRoot = core.getInput("store-path", { required: true });

  const info = await getGhcInfo(ghcPath);

  // Slight approximations but they only have to work on a finite number of cases.
  const compilerId = `ghc-${info["Project version"]}`;
  const compilerAbiTag = info["Project Unit Id"];

  const storeDirectory = versionAtLeast(cabalVersion, "3.12")
    ? path.join(storeRoot, compilerAbiTag || compilerId)
    : path.join(storeRoot, compilerId);

  return storeDirectory;
}
