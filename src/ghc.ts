import * as core from "@actions/core";
import * as io from "@actions/io";
import { execWithOutput } from "./exec.js";

export interface GhcInfo {
  ghcPath: string;
  ghcPkgPath: string;
  ghcInfo: { [key: string]: string };
}

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

export async function findGhc(compilerId: string): Promise<GhcInfo> {
  const ghcPath: string =
    core.getInput("ghc") || (await io.which(compilerId, false)) || "ghc";

  const ghcPkgPath =
    core.getInput("ghc-pkg") || ghcPath.replace("ghc", "ghc-pkg");

  const ghcInfo = await getGhcInfo(ghcPath);

  return { ghcPath, ghcPkgPath, ghcInfo };
}
