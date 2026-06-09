/**
 * list_categories — the static category list with per-category pattern counts.
 */

import {
  ALL_CATEGORIES,
  CATEGORY_DESCRIPTIONS,
  type Pattern,
} from "../types.js";

export interface CategoryInfo {
  id: string;
  description: string;
  pattern_count: number;
}

export interface ListCategoriesOutput {
  categories: CategoryInfo[];
}

export function listCategories(patterns: Pattern[]): ListCategoriesOutput {
  return {
    categories: ALL_CATEGORIES.map((category) => ({
      id: category,
      description: CATEGORY_DESCRIPTIONS[category],
      pattern_count: patterns.filter((p) => p.frontmatter.category === category)
        .length,
    })),
  };
}
