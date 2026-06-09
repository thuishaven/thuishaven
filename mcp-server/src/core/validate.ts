/**
 * Schema validation for pattern sources. Node-only contexts: the bundle build
 * script, the Docker/stdio entry points, and tests. Never import this from
 * workers.ts — ajv compiles schemas with `new Function`, which Cloudflare
 * Workers forbids; the Workers runtime trusts the build-time-validated bundle.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Ajv } from "ajv";
import matter from "gray-matter";
import { assemblePatterns } from "./loader.js";
import type { Pattern, PatternSource } from "./types.js";

const MODULE_DIR = new URL(".", import.meta.url).pathname;
// src/core/ (or dist/core/) -> mcp-server/ -> repo root -> schema/
const SCHEMA_PATH = resolve(
  MODULE_DIR, "..", "..", "..", "schema", "pattern.schema.json",
);

export class PatternValidationError extends Error {
  constructor(
    public readonly filename: string,
    public readonly problems: string[],
  ) {
    super(`${filename}: ${problems.join("; ")}`);
    this.name = "PatternValidationError";
  }
}

/** Parse a raw markdown file into an unvalidated pattern source. */
export function parsePatternFile(filename: string, raw: string): PatternSource {
  const parsed = matter(raw);
  return { filename, frontmatter: parsed.data, body: parsed.content };
}

/**
 * Validate sources against the pattern schema and assemble them.
 * Throws PatternValidationError on the first invalid source.
 */
export function validateAndAssemble(sources: PatternSource[]): Pattern[] {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as object;
  const ajv = new Ajv({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);

  for (const source of sources) {
    if (!validate(source.frontmatter)) {
      const problems = (validate.errors ?? []).map(
        (e) => `${e.instancePath === "" ? "(root)" : e.instancePath} ${e.message ?? "invalid"}`,
      );
      throw new PatternValidationError(source.filename, problems);
    }
    const id = (source.frontmatter as { id: string }).id;
    const expected = source.filename.replace(/\.md$/, "");
    if (id !== expected) {
      throw new PatternValidationError(source.filename, [
        `id "${id}" does not match filename (expected "${expected}")`,
      ]);
    }
    if (source.body.trim().length === 0) {
      throw new PatternValidationError(source.filename, ["markdown body is empty"]);
    }
  }

  return assemblePatterns(sources);
}
