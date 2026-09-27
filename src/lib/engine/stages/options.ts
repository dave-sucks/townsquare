import type { AgentVersionConfig } from "../agents/registry";

/**
 * How a stage runs: with the active prompt version (the pipeline), or with
 * a given version and no writes (the Agents playground).
 */
export type StageOptions = {
  version?: AgentVersionConfig;
  /** Compute only: no review items, no product writes. */
  dryRun?: boolean;
};
