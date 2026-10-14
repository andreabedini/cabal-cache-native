import * as path from "path";
import { CabalPath } from "./cabal.js";
import { getGhcInfo } from "./ghc.js";

// Returns the store directory for the project's compiler. Cabal-install calls
// `store-dir` the "store root", which contains one store directory per
// compiler.
export async function getStoreDirectory(cabal: CabalPath): Promise<string> {
  // cabal-install 3.16 and later tell us directly.
  const storePath = cabal.compiler["store-path"];
  if (storePath) {
    return storePath;
  }

  // cabal-install 3.12 and 3.14 do not, but they name the directory after the
  // compiler ABI tag: GHC's "Project Unit Id" (GHC 9.8 and later) or, when
  // that is missing, the compiler id.
  const info = await getGhcInfo(cabal.compiler.path);
  return path.join(
    cabal["store-dir"],
    info["Project Unit Id"] || cabal.compiler.id,
  );
}
