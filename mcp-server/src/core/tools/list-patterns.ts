/**
 * list_patterns — list all available patterns, optionally filtered by
 * category, status, or tag.
 */

import type { Pattern, PatternStatus } from "../types.js";

export interface ListPatternsInput {
  category?: string;
  status?: PatternStatus;
  tag?: string;
}

export interface PatternSummary {
  id: string;
  title: string;
  category: string;
  status: string;
  problem: string;
  estimated_time_minutes: number;
}

export interface ListPatternsOutput {
  patterns: PatternSummary[];
}

export function listPatterns(
  patterns: Pattern[],
  input: ListPatternsInput = {},
): ListPatternsOutput {
  const filtered = patterns.filter((p) => {
    const fm = p.frontmatter;
    if (input.category !== undefined && fm.category !== input.category) return false;
    if (input.status !== undefined && fm.status !== input.status) return false;
    if (input.tag !== undefined && !fm.tags.includes(input.tag)) return false;
    return true;
  });

  return {
    patterns: filtered.map((p) => ({
      id: p.frontmatter.id,
      title: p.frontmatter.title,
      category: p.frontmatter.category,
      status: p.frontmatter.status,
      problem: p.frontmatter.problem.trim(),
      estimated_time_minutes: p.frontmatter.estimated_time_minutes,
    })),
  };
}
