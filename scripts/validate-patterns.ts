/**
 * validate-patterns.ts
 *
 * Standalone CLI that validates every pattern in patterns/ against
 * schema/pattern.schema.json. Used locally and by CI.
 *
 * Checks performed:
 *   1. YAML frontmatter parses without errors.
 *   2. Frontmatter validates against the JSON Schema.
 *   3. The `id` field matches the filename (without .md).
 *   4. Every id in `related` refers to an existing pattern file.
 *   5. The markdown body is non-empty.
 *   6. v2 fields are internally consistent: unique input names, unique
 *      assertion ids, each assertion has exactly one of check/manual, and
 *      every ${INPUT} an assertion references is a declared input.
 *
 * Exit code 0 when all patterns pass, 1 on any failure.
 *
 * Usage: npx tsx scripts/validate-patterns.ts [patterns-dir]
 */

import { readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import matter from "gray-matter";
import { Ajv, type ErrorObject } from "ajv";

const SCRIPT_DIR = new URL(".", import.meta.url).pathname;
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const PATTERNS_DIR = resolve(process.argv[2] ?? join(REPO_ROOT, "patterns"));
const SCHEMA_PATH = join(REPO_ROOT, "schema", "pattern.schema.json");

interface Frontmatter {
  id?: unknown;
  related?: unknown;
  inputs?: unknown;
  assertions?: unknown;
  [key: string]: unknown;
}

interface PatternFile {
  file: string;
  frontmatter: Frontmatter | null;
  body: string;
  parseError: string | null;
}

function formatAjvError(error: ErrorObject): string {
  const path = error.instancePath === "" ? "(root)" : error.instancePath;
  let detail = error.message ?? "invalid";
  if (error.keyword === "enum" && Array.isArray(error.params["allowedValues"])) {
    detail += `: ${(error.params["allowedValues"] as unknown[]).join(", ")}`;
  }
  if (error.keyword === "additionalProperties") {
    detail += ` (unexpected key: "${String(error.params["additionalProperty"])}")`;
  }
  return `${path} ${detail}`;
}

interface InputSpec {
  name?: unknown;
}
interface AssertionSpec {
  id?: unknown;
  check?: unknown;
  manual?: unknown;
}

/**
 * Semantic checks for the v2 fields the JSON Schema can't express (uniqueness,
 * check XOR manual, ${INPUT} references resolving to a declared input).
 * Returns human-readable problem strings; empty when all good.
 */
function checkV2Fields(frontmatter: Frontmatter): string[] {
  const problems: string[] = [];

  const inputNames = new Set<string>();
  if (Array.isArray(frontmatter.inputs)) {
    for (const raw of frontmatter.inputs) {
      const name = (raw as InputSpec)?.name;
      if (typeof name === "string") {
        if (inputNames.has(name)) {
          problems.push(`duplicate input name "${name}"`);
        }
        inputNames.add(name);
      }
    }
  }

  if (Array.isArray(frontmatter.assertions)) {
    const ids = new Set<string>();
    for (const raw of frontmatter.assertions) {
      const a = raw as AssertionSpec;
      const id = typeof a?.id === "string" ? a.id : "(unnamed)";

      if (typeof a?.id === "string") {
        if (ids.has(a.id)) problems.push(`duplicate assertion id "${a.id}"`);
        ids.add(a.id);
      }

      const hasCheck = typeof a?.check === "string" && a.check.length > 0;
      const isManual = a?.manual === true;
      if (hasCheck && isManual) {
        problems.push(`assertion "${id}" has both check and manual (pick one)`);
      } else if (!hasCheck && !isManual) {
        problems.push(`assertion "${id}" needs either a check or manual: true`);
      }

      if (hasCheck) {
        const referenced = (a.check as string).match(/\$\{([A-Z][A-Z0-9_]*)\}/g) ?? [];
        for (const token of referenced) {
          const name = token.slice(2, -1);
          if (!inputNames.has(name)) {
            problems.push(
              `assertion "${id}" references \${${name}} which is not a declared input`,
            );
          }
        }
      }
    }
  }

  return problems;
}

function loadPatternFile(filePath: string): PatternFile {
  const file = basename(filePath);
  const raw = readFileSync(filePath, "utf8");
  try {
    const parsed = matter(raw);
    return {
      file,
      frontmatter: parsed.data as Frontmatter,
      body: parsed.content,
      parseError: null,
    };
  } catch (err) {
    return {
      file,
      frontmatter: null,
      body: "",
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

function main(): void {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as object;
  const ajv = new Ajv({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);

  let files: string[];
  try {
    files = readdirSync(PATTERNS_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch (err) {
    console.error(`Cannot read patterns directory: ${PATTERNS_DIR}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`No pattern files (*.md) found in ${PATTERNS_DIR}`);
    process.exit(1);
  }

  const patterns = files.map((f) => loadPatternFile(join(PATTERNS_DIR, f)));
  const knownIds = new Set(
    patterns
      .map((p) => p.frontmatter?.id)
      .filter((id): id is string => typeof id === "string"),
  );

  let failures = 0;

  for (const pattern of patterns) {
    const errors: string[] = [];

    if (pattern.parseError !== null) {
      errors.push(`frontmatter could not be parsed: ${pattern.parseError}`);
    } else if (
      pattern.frontmatter === null ||
      Object.keys(pattern.frontmatter).length === 0
    ) {
      errors.push("file has no YAML frontmatter");
    } else {
      if (!validate(pattern.frontmatter)) {
        for (const err of validate.errors ?? []) {
          errors.push(`schema: ${formatAjvError(err)}`);
        }
      }

      const expectedId = pattern.file.replace(/\.md$/, "");
      if (
        typeof pattern.frontmatter.id === "string" &&
        pattern.frontmatter.id !== expectedId
      ) {
        errors.push(
          `id "${pattern.frontmatter.id}" does not match filename (expected "${expectedId}")`,
        );
      }

      if (Array.isArray(pattern.frontmatter.related)) {
        for (const rel of pattern.frontmatter.related) {
          if (typeof rel === "string" && !knownIds.has(rel)) {
            errors.push(`related pattern "${rel}" does not exist in patterns/`);
          }
        }
      }

      if (pattern.body.trim().length === 0) {
        errors.push("markdown body is empty");
      }

      errors.push(...checkV2Fields(pattern.frontmatter));
    }

    if (errors.length > 0) {
      failures += 1;
      console.error(`✗ ${pattern.file}`);
      for (const e of errors) {
        console.error(`    ${e}`);
      }
    } else {
      console.log(`✓ ${pattern.file}`);
    }
  }

  console.log("");
  if (failures > 0) {
    console.error(
      `${failures} of ${patterns.length} pattern(s) failed validation.`,
    );
    process.exit(1);
  }
  console.log(`All ${patterns.length} pattern(s) are valid.`);
}

main();
