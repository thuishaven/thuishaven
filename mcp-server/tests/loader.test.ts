import { describe, expect, it } from "vitest";
import { assemblePatterns, patternsFromBundle } from "../src/core/loader.js";
import {
  PatternValidationError,
  parsePatternFile,
  validateAndAssemble,
} from "../src/core/validate.js";
import { loadPatternsFromFs } from "../src/node/load-from-fs.js";
import { makeFrontmatter, makePattern } from "./helpers.js";

const VALID_MD = `---
id: test-pattern
title: "A test pattern"
version: 1
status: experimental
category: collaboration
tags: [testing]
maintainer: hiddevh
problem: You need a fixture.
recommendation:
  app: testapp
  app_source: https://example.com/testapp
  deploy_target: dokploy
  exposure: public-domain
alternatives: []
prerequisites: []
estimated_time_minutes: 5
gotchas: []
related: []
---

# Body
`;

describe("parsePatternFile", () => {
  it("splits frontmatter and body", () => {
    const source = parsePatternFile("test-pattern.md", VALID_MD);
    expect(source.filename).toBe("test-pattern.md");
    expect((source.frontmatter as { id: string }).id).toBe("test-pattern");
    expect(source.body).toContain("# Body");
  });
});

describe("validateAndAssemble", () => {
  it("accepts a valid source", () => {
    const patterns = validateAndAssemble([
      parsePatternFile("test-pattern.md", VALID_MD),
    ]);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.frontmatter.title).toBe("A test pattern");
  });

  it("rejects schema violations with the offending path", () => {
    const source = parsePatternFile(
      "test-pattern.md",
      VALID_MD.replace("status: experimental", "status: bogus"),
    );
    expect(() => validateAndAssemble([source])).toThrowError(
      PatternValidationError,
    );
    expect(() => validateAndAssemble([source])).toThrowError(/\/status/);
  });

  it("rejects an id that does not match the filename", () => {
    const source = parsePatternFile("other-name.md", VALID_MD);
    expect(() => validateAndAssemble([source])).toThrowError(
      /does not match filename/,
    );
  });

  it("rejects an empty body", () => {
    const source = parsePatternFile(
      "test-pattern.md",
      VALID_MD.replace("# Body", "   "),
    );
    expect(() => validateAndAssemble([source])).toThrowError(/body is empty/);
  });
});

describe("assemblePatterns", () => {
  it("rejects duplicate ids", () => {
    const a = makePattern();
    const b = makePattern();
    expect(() => assemblePatterns([a, b])).toThrowError(/Duplicate pattern id/);
  });

  it("sorts patterns by id", () => {
    const patterns = assemblePatterns([
      makePattern({ id: "zzz" }),
      makePattern({ id: "aaa" }),
    ]);
    expect(patterns.map((p) => p.frontmatter.id)).toEqual(["aaa", "zzz"]);
  });

  it("rejects structurally broken sources", () => {
    expect(() =>
      assemblePatterns([{ frontmatter: { nope: true }, body: "x" }]),
    ).toThrowError(/structurally invalid/);
  });
});

describe("patternsFromBundle", () => {
  it("round-trips a bundle", () => {
    const original = [makePattern({ id: "aaa" }), makePattern({ id: "bbb" })];
    const bundle = JSON.parse(JSON.stringify({ patterns: original }));
    const loaded = patternsFromBundle(bundle);
    expect(loaded).toEqual(original);
  });
});

describe("loadPatternsFromFs (against the real repo patterns)", () => {
  it("loads and validates every shipped pattern", () => {
    const patterns = loadPatternsFromFs();
    expect(patterns.length).toBeGreaterThanOrEqual(3);
    const ids = patterns.map((p) => p.frontmatter.id);
    expect(ids).toContain("dokploy-bootstrap");
    expect(ids).toContain("scheduling-tool");
    expect(ids).toContain("vaultwarden-family");
  });
});

describe("frontmatter fixture", () => {
  it("matches the schema (helpers stay valid as the schema evolves)", () => {
    const fm = makeFrontmatter();
    expect(() =>
      validateAndAssemble([
        { filename: `${fm.id}.md`, frontmatter: fm, body: "# x" },
      ]),
    ).not.toThrow();
  });
});
