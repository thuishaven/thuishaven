/** Test fixtures: minimal valid patterns with overridable fields. */

import type { Pattern, PatternFrontmatter } from "../src/core/types.js";

export function makeFrontmatter(
  overrides: Partial<PatternFrontmatter> = {},
): PatternFrontmatter {
  return {
    id: "test-pattern",
    title: "A test pattern",
    version: 1,
    status: "experimental",
    category: "collaboration",
    tags: ["testing"],
    maintainer: "hiddevh",
    problem: "You need a fixture for unit tests.",
    recommendation: {
      app: "testapp",
      app_source: "https://example.com/testapp",
      deploy_target: "dokploy",
      exposure: "public-domain",
    },
    alternatives: [],
    prerequisites: [],
    estimated_time_minutes: 5,
    gotchas: [],
    related: [],
    ...overrides,
  };
}

export function makePattern(
  overrides: Partial<PatternFrontmatter> = {},
  body = "# Body\n\nSome instructions.",
): Pattern {
  return { frontmatter: makeFrontmatter(overrides), body };
}

/** The three-pattern collection mirroring the real repo's shape. */
export function makeCollection(): Pattern[] {
  return [
    makePattern({
      id: "dokploy-bootstrap",
      title: "Set up a fresh Ubuntu server for self-hosting",
      category: "bootstrap",
      tags: ["dokploy", "docker", "tailscale", "server-setup"],
      problem: "You have an Ubuntu server and want a foundation for self-hosting.",
      recommendation: {
        app: "dokploy",
        app_source: "https://github.com/Dokploy/dokploy",
        deploy_target: "dokploy",
        exposure: "tailnet",
      },
      related: ["scheduling-tool"],
    }),
    makePattern({
      id: "scheduling-tool",
      title: "Date picker for sharing with friends",
      category: "collaboration",
      status: "stable",
      tags: ["scheduling", "polls", "no-account-needed"],
      problem:
        "You want to schedule a date with friends or family without Doodle. Shareable via a link.",
      recommendation: {
        app: "rallly",
        app_source: "https://github.com/lukevella/rallly",
        deploy_target: "dokploy",
        exposure: "public-domain",
      },
      related: ["dokploy-bootstrap"],
    }),
    makePattern({
      id: "vaultwarden-family",
      title: "Move your family off 1Password to self-hosted Vaultwarden",
      category: "security",
      tags: ["passwords", "family", "bitwarden"],
      problem:
        "You pay for a family password manager and want to self-host the vault instead.",
      recommendation: {
        app: "vaultwarden",
        app_source: "https://github.com/dani-garcia/vaultwarden",
        deploy_target: "dokploy",
        exposure: "public-domain",
      },
      related: ["dokploy-bootstrap"],
    }),
  ];
}
