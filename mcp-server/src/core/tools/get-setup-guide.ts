/**
 * get_setup_guide — convenience entry point returning the bootstrap pattern
 * for a given target. These are ordinary patterns under category `bootstrap`;
 * this tool just maps a target name to the right pattern id.
 */

import { ToolError, type Pattern } from "../types.js";
import { getPattern, type GetPatternOutput } from "./get-pattern.js";

export type SetupTarget = "dokploy" | "docker-compose" | "tailscale-exit-node";

export interface GetSetupGuideInput {
  target: SetupTarget;
}

export interface GetSetupGuideOutput {
  pattern: GetPatternOutput;
}

/** Which pattern serves each setup target. */
const TARGET_PATTERN_IDS: Record<SetupTarget, string> = {
  dokploy: "dokploy-bootstrap",
  "docker-compose": "docker-compose-bootstrap",
  "tailscale-exit-node": "tailscale-exit-node",
};

export function getSetupGuide(
  patterns: Pattern[],
  input: GetSetupGuideInput,
): GetSetupGuideOutput {
  const patternId = TARGET_PATTERN_IDS[input.target];
  if (patternId === undefined) {
    throw new ToolError(
      `Unknown setup target "${String(input.target)}". Supported targets: ${Object.keys(TARGET_PATTERN_IDS).join(", ")}`,
    );
  }
  const exists = patterns.some((p) => p.frontmatter.id === patternId);
  if (!exists) {
    throw new ToolError(
      `No pattern exists yet for setup target "${input.target}". ` +
        `Use list_patterns with category "bootstrap" to see what is available.`,
    );
  }
  return { pattern: getPattern(patterns, { id: patternId }) };
}
