import * as core from "@actions/core";
import * as fs from "fs/promises";
import * as path from "path";

export type Unit = {
  id: string;
  style: "local" | "global";
  depends: string[];
};

export type Plan = {
  "compiler-id": string;
  "install-plan": Unit[];
};

export type AdjacencyList = { [key: string]: string[] };

export function toAdjacencyList(units: Unit[]): AdjacencyList {
  const graph: AdjacencyList = {};
  for (const unit of units) {
    graph[unit.id] = unit.depends;
  }
  return graph;
}

export type K = (key: string) => Promise<boolean>;

export type Result = Promise<{
  completed: Set<string>;
  failed: Set<string>;
  skipped: Set<string>;
}>;

export async function traverse(graph: AdjacencyList, k: K): Result {
  const completed: Set<string> = new Set();
  const visited: Set<string> = new Set();
  const failed: Set<string> = new Set();
  const skipped: Set<string> = new Set();

  async function visit(node: string): Promise<void> {
    visited.add(node);
    for (const neighbor of graph[node] || []) {
      // If neighbor was skipped or had failed we bail processing node
      // and mark it as skipped too.
      if (failed.has(neighbor) || skipped.has(neighbor)) {
        skipped.add(node);
        return;
      }
      if (!visited.has(neighbor)) {
        await visit(neighbor);
      }
    }

    if (await k(node)) {
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
