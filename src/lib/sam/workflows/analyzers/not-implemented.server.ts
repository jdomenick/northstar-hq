// Placeholder analyzer for workflows scaffolded in Milestone 2 but not yet
// implemented. Fails honestly with `workflow_not_implemented`  -  never
// pretends an empty successful run.

import { SamError } from "@/lib/errors";
import type { WorkflowAnalyzer } from "./types";
import { WORKFLOW_ENGINE_VERSION } from "@/lib/constants";

export const notImplementedAnalyzer: WorkflowAnalyzer = {
  key: "not_implemented",
  version: WORKFLOW_ENGINE_VERSION,
  analyze() {
    throw new SamError("workflow_not_implemented");
  },
};