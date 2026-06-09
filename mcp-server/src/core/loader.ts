/**
 * Runtime-agnostic pattern assembly.
 *
 * This module is imported by ALL entry points, including Cloudflare Workers,
 * so it must not depend on Node APIs or on ajv (whose schema compilation uses
 * `new Function`, which the Workers runtime forbids). Schema validation lives
 * in validate.ts and runs wherever Node runs: the bundle build step, the
 * Docker/stdio entries, and CI.
 */

import type { Pattern, PatternFrontmatter, PatternsBundle } from "./types.js";

/**
 * Assemble patterns from sources whose frontmatter has already been validated
 * against the schema. Performs only cheap structural checks as a guard
 * against a stale or hand-edited bundle.
 */
export function assemblePatterns(
  sources: Array<{ frontmatter: unknown; body: string }>,
): Pattern[] {
  const patterns = sources.map((source) => {
    const fm = source.frontmatter as PatternFrontmatter;
    if (
      typeof fm !== "object" ||
      fm === null ||
      typeof fm.id !== "string" ||
      typeof fm.title !== "string" ||
      typeof fm.problem !== "string" ||
      !Array.isArray(fm.tags)
    ) {
      throw new Error(
        "Pattern source is structurally invalid — was it validated before bundling?",
      );
    }
    return { frontmatter: fm, body: source.body };
  });

  const ids = new Set<string>();
  for (const p of patterns) {
    if (ids.has(p.frontmatter.id)) {
      throw new Error(`Duplicate pattern id: ${p.frontmatter.id}`);
    }
    ids.add(p.frontmatter.id);
  }

  return patterns.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
}

/** Load patterns from a pre-built, build-time-validated bundle (Workers mode). */
export function patternsFromBundle(bundle: PatternsBundle): Pattern[] {
  return assemblePatterns(bundle.patterns);
}
