/**
 * find_pattern_for_problem — match a free-text problem description to
 * patterns via keyword overlap. Per the spec: no embeddings, no LLM calls.
 * Score = (matched keywords / total keywords in description), weighted so
 * that tag matches count double.
 */

import type { Pattern } from "../types.js";

export interface FindPatternInput {
  description: string;
  limit?: number;
}

export interface PatternMatch {
  id: string;
  title: string;
  relevance_score: number;
  why_matched: string;
}

export interface FindPatternOutput {
  matches: PatternMatch[];
}

const DEFAULT_LIMIT = 3;

/**
 * Words too common to carry signal in a problem description — generic English
 * plus the boilerplate agents put in queries ("find me a pattern/app for...").
 */
const STOPWORDS = new Set([
  "a", "an", "and", "app", "application", "are", "as", "at", "be", "but",
  "by", "can", "do", "find", "for", "from", "have", "host", "hosted",
  "hosting", "how", "i", "in", "is", "it", "like", "looking", "me", "my",
  "need", "of", "on", "or", "our", "pattern", "patterns", "please", "self",
  "selfhost", "selfhosted", "service", "set", "setup", "so", "some",
  "something", "that", "the", "this", "to", "tool", "up", "use", "want",
  "we", "with", "without", "you", "your",
]);

/** Lowercase, split on non-alphanumerics, drop stopwords and 1-char tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Naive singular/plural normalization so "polls" matches "poll". */
function stem(token: string): string {
  if (token.length > 3 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 2 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function toStemSet(tokens: string[]): Set<string> {
  return new Set(tokens.map(stem));
}

export function findPatternForProblem(
  patterns: Pattern[],
  input: FindPatternInput,
): FindPatternOutput {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const descriptionTokens = [...new Set(tokenize(input.description))];

  if (descriptionTokens.length === 0) {
    return { matches: [] };
  }

  const scored = patterns.map((pattern) => {
    const fm = pattern.frontmatter;
    const tagStems = toStemSet(fm.tags.flatMap((tag) => tokenize(tag)));
    const textStems = toStemSet([
      ...tokenize(fm.title),
      ...tokenize(fm.problem),
      ...tokenize(fm.recommendation.app),
      fm.id.toLowerCase(),
      ...tokenize(fm.id),
    ]);

    const tagMatches: string[] = [];
    const textMatches: string[] = [];
    for (const token of descriptionTokens) {
      const s = stem(token);
      if (tagStems.has(s)) {
        tagMatches.push(token);
      } else if (textStems.has(s)) {
        textMatches.push(token);
      }
    }

    // Tag matches weigh double; normalize by the double-weight maximum so the
    // score stays in 0..1 and a full tag-level match approaches 1.
    const weighted = tagMatches.length * 2 + textMatches.length;
    const score = weighted / (descriptionTokens.length * 2);

    const reasons: string[] = [];
    if (tagMatches.length > 0) reasons.push(`matches tags: ${tagMatches.join(", ")}`);
    if (textMatches.length > 0) {
      reasons.push(`matches problem/title keywords: ${textMatches.join(", ")}`);
    }

    return {
      id: fm.id,
      title: fm.title,
      relevance_score: Math.min(1, Math.round(score * 100) / 100),
      why_matched: reasons.join("; "),
    };
  });

  return {
    matches: scored
      .filter((m) => m.relevance_score > 0)
      .sort((a, b) => b.relevance_score - a.relevance_score || a.id.localeCompare(b.id))
      .slice(0, limit),
  };
}
