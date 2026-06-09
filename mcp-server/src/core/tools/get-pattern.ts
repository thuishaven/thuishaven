/**
 * get_pattern — full content of a single pattern by id.
 */

import {
  PATTERN_SOURCE_BASE_URL,
  ToolError,
  type Pattern,
  type PatternFrontmatter,
} from "../types.js";

export interface GetPatternInput {
  id: string;
}

export interface GetPatternOutput {
  frontmatter: PatternFrontmatter;
  body: string;
  source_url: string;
}

export function getPattern(
  patterns: Pattern[],
  input: GetPatternInput,
): GetPatternOutput {
  const pattern = patterns.find((p) => p.frontmatter.id === input.id);
  if (pattern === undefined) {
    const known = patterns.map((p) => p.frontmatter.id).join(", ");
    throw new ToolError(
      `Unknown pattern id "${input.id}". Available patterns: ${known}`,
    );
  }
  return {
    frontmatter: pattern.frontmatter,
    body: pattern.body,
    source_url: `${PATTERN_SOURCE_BASE_URL}/${pattern.frontmatter.id}.md`,
  };
}
