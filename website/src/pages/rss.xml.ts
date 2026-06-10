/**
 * RSS feed of patterns. Patterns carry no date field (Git history is the
 * archive), so items are dateless; the feed is a discovery surface for
 * new/updated patterns, with the version in the title.
 */

import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const patterns = (await getCollection("patterns")).sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  return rss({
    title: "Thuishaven patterns",
    description:
      "Opinionated, agent-readable self-hosting patterns. New and updated patterns appear here.",
    site: context.site!,
    items: patterns.map((pattern) => ({
      title: `${pattern.data.title} (v${pattern.data.version}, ${pattern.data.status})`,
      description: pattern.data.problem.trim(),
      link: `/patterns/${pattern.id}/`,
    })),
  });
}
