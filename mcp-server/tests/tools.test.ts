import { describe, expect, it } from "vitest";
import { findPatternForProblem } from "../src/core/tools/find-pattern-for-problem.js";
import { getPattern } from "../src/core/tools/get-pattern.js";
import { getSetupGuide } from "../src/core/tools/get-setup-guide.js";
import { listCategories } from "../src/core/tools/list-categories.js";
import { listPatterns } from "../src/core/tools/list-patterns.js";
import { ToolError } from "../src/core/types.js";
import { makeCollection } from "./helpers.js";

const patterns = makeCollection();

describe("list_patterns", () => {
  it("lists all patterns unfiltered", () => {
    const out = listPatterns(patterns);
    expect(out.patterns).toHaveLength(3);
    expect(out.patterns[0]).toEqual({
      id: "dokploy-bootstrap",
      title: "Set up a fresh Ubuntu server for self-hosting",
      category: "bootstrap",
      status: "experimental",
      problem: expect.stringContaining("Ubuntu server"),
      estimated_time_minutes: 5,
    });
  });

  it("filters by category", () => {
    const out = listPatterns(patterns, { category: "security" });
    expect(out.patterns.map((p) => p.id)).toEqual(["vaultwarden-family"]);
  });

  it("filters by status", () => {
    const out = listPatterns(patterns, { status: "stable" });
    expect(out.patterns.map((p) => p.id)).toEqual(["scheduling-tool"]);
  });

  it("filters by tag", () => {
    const out = listPatterns(patterns, { tag: "polls" });
    expect(out.patterns.map((p) => p.id)).toEqual(["scheduling-tool"]);
  });

  it("combines filters", () => {
    const out = listPatterns(patterns, { category: "bootstrap", tag: "polls" });
    expect(out.patterns).toHaveLength(0);
  });

  it("returns empty for an unknown category instead of throwing", () => {
    expect(listPatterns(patterns, { category: "nope" }).patterns).toHaveLength(0);
  });
});

describe("get_pattern", () => {
  it("returns frontmatter, body, and a GitHub source_url", () => {
    const out = getPattern(patterns, { id: "scheduling-tool" });
    expect(out.frontmatter.title).toBe("Date picker for sharing with friends");
    expect(out.body).toContain("instructions");
    expect(out.source_url).toBe(
      "https://github.com/thuishaven/thuishaven/blob/main/patterns/scheduling-tool.md",
    );
  });

  it("throws a ToolError naming available ids for an unknown id", () => {
    expect(() => getPattern(patterns, { id: "nope" })).toThrowError(ToolError);
    expect(() => getPattern(patterns, { id: "nope" })).toThrowError(
      /dokploy-bootstrap/,
    );
  });
});

describe("find_pattern_for_problem", () => {
  it("matches the spec's canonical example query", () => {
    const out = findPatternForProblem(patterns, {
      description: "I want to share a date picker with friends",
    });
    expect(out.matches[0]?.id).toBe("scheduling-tool");
    expect(out.matches[0]?.relevance_score).toBeGreaterThan(0);
    expect(out.matches[0]?.relevance_score).toBeLessThanOrEqual(1);
    expect(out.matches[0]?.why_matched).not.toBe("");
  });

  it("ranks tag matches above plain text matches", () => {
    const out = findPatternForProblem(patterns, {
      description: "scheduling polls",
    });
    expect(out.matches[0]?.id).toBe("scheduling-tool");
    expect(out.matches[0]?.why_matched).toContain("tags");
  });

  it("matches singular/plural variants", () => {
    const out = findPatternForProblem(patterns, {
      description: "poll for picking dates",
    });
    expect(out.matches.map((m) => m.id)).toContain("scheduling-tool");
  });

  it("finds the password pattern for a password problem", () => {
    const out = findPatternForProblem(patterns, {
      description: "self-hosted password manager for my family",
    });
    expect(out.matches[0]?.id).toBe("vaultwarden-family");
  });

  it("respects the limit", () => {
    const out = findPatternForProblem(patterns, {
      description: "self-hosting server family passwords scheduling",
      limit: 1,
    });
    expect(out.matches).toHaveLength(1);
  });

  it("defaults to at most 3 matches", () => {
    const out = findPatternForProblem(patterns, {
      description: "server family passwords scheduling dokploy",
    });
    expect(out.matches.length).toBeLessThanOrEqual(3);
  });

  it("returns no matches for an unrelated description", () => {
    const out = findPatternForProblem(patterns, {
      description: "quantum chromodynamics lecture notes",
    });
    expect(out.matches).toHaveLength(0);
  });

  it("returns no matches for an empty description", () => {
    expect(findPatternForProblem(patterns, { description: "  " }).matches).toEqual(
      [],
    );
  });
});

describe("list_categories", () => {
  it("returns every category with counts, including empty ones", () => {
    const out = listCategories(patterns);
    expect(out.categories).toHaveLength(7);
    const byId = Object.fromEntries(out.categories.map((c) => [c.id, c]));
    expect(byId["bootstrap"]?.pattern_count).toBe(1);
    expect(byId["security"]?.pattern_count).toBe(1);
    expect(byId["collaboration"]?.pattern_count).toBe(1);
    expect(byId["media"]?.pattern_count).toBe(0);
    expect(byId["bootstrap"]?.description).toContain("Dokploy");
  });
});

describe("get_setup_guide", () => {
  it("returns the dokploy bootstrap pattern for target dokploy", () => {
    const out = getSetupGuide(patterns, { target: "dokploy" });
    expect(out.pattern.frontmatter.id).toBe("dokploy-bootstrap");
    expect(out.pattern.source_url).toContain("dokploy-bootstrap.md");
  });

  it("explains when no pattern exists yet for a known target", () => {
    expect(() =>
      getSetupGuide(patterns, { target: "tailscale-exit-node" }),
    ).toThrowError(/No pattern exists yet/);
  });

  it("rejects unknown targets", () => {
    expect(() =>
      getSetupGuide(patterns, { target: "heroku" as never }),
    ).toThrowError(/Unknown setup target/);
  });
});
