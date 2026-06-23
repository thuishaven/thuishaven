/**
 * Content collections. The patterns collection reads the canonical markdown
 * files from ../patterns (outside the website root — zero content
 * duplication). The zod schema mirrors schema/pattern.schema.json; keep both
 * in sync.
 */

import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const CATEGORIES = [
  "bootstrap",
  "productivity",
  "collaboration",
  "media",
  "security",
  "monitoring",
  "family",
] as const;

export const STATUSES = ["stable", "experimental", "deprecated"] as const;

const patterns = defineCollection({
  loader: glob({ pattern: "*.md", base: "../patterns" }),
  schema: z
    .object({
      id: z.string().regex(kebab),
      title: z.string().min(1),
      version: z.number().int().min(1),
      status: z.enum(STATUSES),
      category: z.enum(CATEGORIES),
      tags: z.array(z.string().regex(kebab)).min(1),
      maintainer: z.string().min(1),
      problem: z.string().min(1),
      recommendation: z
        .object({
          app: z.string().min(1),
          app_source: z.string().regex(/^https?:\/\//),
          deploy_target: z.enum(["dokploy", "docker-compose", "coolify", "k8s"]),
          exposure: z.enum([
            "public-domain",
            "tailnet",
            "cloudflare-tunnel",
            "local-only",
          ]),
        })
        .strict(),
      alternatives: z
        .array(
          z.object({ name: z.string().min(1), reason_not_chosen: z.string().min(1) }).strict(),
        ),
      prerequisites: z.array(z.string().regex(kebab)),
      estimated_time_minutes: z.number().int().min(1),
      gotchas: z.array(z.string().min(1)),
      tested_against: z
        .object({
          app_version: z.string().min(1),
          verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          upstream_docs: z.string().regex(/^https?:\/\//).optional(),
        })
        .strict()
        .optional(),
      inputs: z
        .array(
          z
            .object({
              name: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
              description: z.string().min(1),
              example: z.string().optional(),
              default: z.string().optional(),
              required: z.boolean().optional(),
              secret: z.boolean().optional(),
              generate: z.string().optional(),
              format: z
                .enum(["string", "email", "url", "hostname", "integer"])
                .optional(),
            })
            .strict(),
        )
        .optional(),
      assertions: z
        .array(
          z
            .object({
              id: z.string().regex(kebab),
              description: z.string().min(1),
              check: z.string().optional(),
              manual: z.boolean().optional(),
            })
            .strict(),
        )
        .optional(),
      related: z.array(z.string().regex(kebab)),
    })
    .strict(),
});

// Root-level docs rendered as pages (currently just CONTRIBUTING.md).
const docs = defineCollection({
  loader: glob({ pattern: "CONTRIBUTING.md", base: ".." }),
});

export const collections = { patterns, docs };
