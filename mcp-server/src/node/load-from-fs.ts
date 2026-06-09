/**
 * Filesystem pattern loading for the Node entry points (Docker HTTP, stdio).
 * Workers never imports this module.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsePatternFile, validateAndAssemble } from "../core/validate.js";
import type { Pattern } from "../core/types.js";

const MODULE_DIR = new URL(".", import.meta.url).pathname;

/**
 * Resolve the patterns directory: PATTERNS_DIR env var if set (so forks can
 * point at their own patterns), otherwise ../patterns relative to the
 * mcp-server package (the repo layout, which the Docker image mirrors).
 */
export function resolvePatternsDir(): string {
  if (process.env["PATTERNS_DIR"] !== undefined && process.env["PATTERNS_DIR"] !== "") {
    return resolve(process.env["PATTERNS_DIR"]);
  }
  // src/node/ -> mcp-server/ -> repo root -> patterns/
  return resolve(MODULE_DIR, "..", "..", "..", "patterns");
}

/** Load and validate every patterns/*.md file. Throws on any invalid pattern. */
export function loadPatternsFromFs(dir: string = resolvePatternsDir()): Pattern[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  if (files.length === 0) {
    throw new Error(`No pattern files (*.md) found in ${dir}`);
  }
  const sources = files.map((file) =>
    parsePatternFile(file, readFileSync(join(dir, file), "utf8")),
  );
  return validateAndAssemble(sources);
}
