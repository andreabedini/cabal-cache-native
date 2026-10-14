import * as path from "path";
import { execWithOutput } from "./exec.js";

export async function getGhcInfo(
  ghcPath: string,
): Promise<{ [key: string]: string }> {
  const output = await execWithOutput(ghcPath, ["--info"]);
  const re = /\("([^"]*)","([^"]*)"\)/g;
  const info: { [key: string]: string } = {};
  let result: RegExpExecArray | null;
  while ((result = re.exec(output))) {
    info[result[1]] = result[2];
  }
  return info;
}

// Guesses ghc-pkg's path from ghc's, e.g. /usr/bin/ghc-9.8.4 becomes
// /usr/bin/ghc-pkg-9.8.4. Only the file name is changed, so directories
// such as ~/.ghcup are left alone.
export function ghcPkgPath(ghcPath: string): string {
  const dir = path.dirname(ghcPath);
  const file = path.basename(ghcPath).replace(/^ghc/, "ghc-pkg");
  return path.join(dir, file);
}
