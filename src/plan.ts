import * as core from "@actions/core";
import * as fs from "fs/promises";
import * as path from "path";

type Depends = {
  depends?: string[];
  "exe-depends"?: string[];
};

export type Unit = Depends & {
  id: string;
  type: "configured" | "pre-existing";
  // Absent for pre-existing units (e.g. base, which comes with the compiler).
  style?: "local" | "global" | "inplace";
  // Packages that are not built per-component list their dependencies per
  // component (including "setup") instead of at the top level.
  components?: { [component: string]: Depends };
};

export type Plan = {
  "cabal-version": string;
  "compiler-id": string;
  "install-plan": Unit[];
};

export type AdjacencyList = { [key: string]: string[] };

function unitDepends(unit: Unit): string[] {
  const all = [unit, ...Object.values(unit.components ?? {})].flatMap((d) => [
    ...(d.depends ?? []),
    ...(d["exe-depends"] ?? []),
  ]);
  return [...new Set(all)];
}

// Builds the dependency graph of the given units. Dependencies on units that
// are not in the list (e.g. pre-existing ones) are dropped, so the graph only
// refers to its own nodes.
export function toAdjacencyList(units: Unit[]): AdjacencyList {
  const ids = new Set(units.map((unit) => unit.id));
  const graph: AdjacencyList = {};
  for (const unit of units) {
    graph[unit.id] = unitDepends(unit).filter((dep) => ids.has(dep));
  }
  return graph;
}

export type K = (key: string) => Promise<boolean>;

export type Result = Promise<{
  completed: Set<string>;
  failed: Set<string>;
  skipped: Set<string>;
}>;

// Calls k on every node, dependencies first, and once per node. A node is
// completed if k returns true and failed otherwise. If any dependency of a
// node failed or was skipped, k is not called and the node is skipped.
export async function traverse(graph: AdjacencyList, k: K): Result {
  const visited: Set<string> = new Set();
  const completed: Set<string> = new Set();
  const failed: Set<string> = new Set();
  const skipped: Set<string> = new Set();

  async function visit(node: string): Promise<void> {
    if (visited.has(node)) {
      return;
    }
    visited.add(node);

    const dependencies = graph[node] ?? [];
    for (const dependency of dependencies) {
      await visit(dependency);
    }

    if (dependencies.some((dep) => failed.has(dep) || skipped.has(dep))) {
      skipped.add(node);
    } else if (await k(node)) {
      completed.add(node);
    } else {
      failed.add(node);
    }
  }

  for (const node in graph) {
    await visit(node);
  }

  return { completed, failed, skipped };
}

export async function readPlanJson(planPath: string): Promise<Plan> {
  try {
    const file = await fs.readFile(planPath);
    return JSON.parse(file.toString());
  } catch (e) {
    const msg = (e as Error).message;
    throw Error(
      `Failed to read build plan from ${planPath}. Perhaps you forgot to run 'cabal build --dry-run?' Exception: ${msg}`,
    );
  }
}

export async function getPlan(): Promise<Plan> {
  const planJson = core.getInput("plan-json");
  const projectPath = core.getInput("project-path");

  const resolvedPath = path.resolve(projectPath, planJson);
  core.info(`Reading the build plan from ${resolvedPath}`);

  return await readPlanJson(resolvedPath);
}
