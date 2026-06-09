/**
 * Build-time bundling for Cloudflare Workers: reads ../patterns/*.md,
 * validates every pattern against the schema, and writes
 * src/patterns.bundle.json for the Worker to import.
 *
 * Output is deterministic (sorted, no timestamps) so rebuilding without
 * pattern changes produces no diff.
 *
 * Usage: npx tsx scripts/build-patterns-bundle.ts
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadPatternsFromFs } from "../src/node/load-from-fs.js";
import type { PatternsBundle } from "../src/core/types.js";

const SCRIPT_DIR = new URL(".", import.meta.url).pathname;
const OUTPUT_PATH = resolve(SCRIPT_DIR, "..", "src", "patterns.bundle.json");

const patterns = loadPatternsFromFs();
const bundle: PatternsBundle = { patterns };

writeFileSync(OUTPUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${patterns.length} pattern(s) to ${OUTPUT_PATH} (${patterns
    .map((p) => p.frontmatter.id)
    .join(", ")})`,
);
