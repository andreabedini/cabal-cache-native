import * as path from "path";
import * as core from "@actions/core";
import { GhcInfo } from "./ghc.js";

function versionAtLeast(ver1: string, ver2: string): boolean {
  return ver1.localeCompare(ver2, undefined, { numeric: true }) >= 0;
}

export async function getStoreDirectory(
  ghcInfo: GhcInfo,
  cabalVersion: string,
) {
  // NOTE: Cabal-install calls this "store root", which contains a separate store directory for each compiler.
  const storeRoot = core.getInput("store-path", { required: true });

  // Slight approximations but they only have to work on a finite number of cases.
  const compilerId = `ghc-${ghcInfo["Project version"]}`;
  const compilerAbiTag = ghcInfo["Project Unit Id"];

  const storeDirectory = versionAtLeast(cabalVersion, "3.12")
    ? path.join(storeRoot, compilerAbiTag || compilerId)
    : path.join(storeRoot, compilerId);

  return storeDirectory;
}
