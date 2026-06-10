/**
 * Rewrite relative markdown links for the website:
 *  - `some-pattern.md` (how patterns cross-reference each other in the repo)
 *    becomes `/patterns/some-pattern/`
 *  - other relative paths (used by CONTRIBUTING.md: `patterns/`,
 *    `schema/pattern.schema.json`) become GitHub URLs
 * Absolute URLs, anchors, and root-relative paths pass through untouched.
 */

const REPO_URL = "https://github.com/thuishaven/thuishaven";
const PATTERN_LINK = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.md(#.*)?$/;

function walk(node, fn) {
  fn(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, fn);
  }
}

export function remarkRepoLinks() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== "link" || typeof node.url !== "string") return;
      const url = node.url;
      if (/^(https?:|mailto:|#|\/)/.test(url)) return;

      const patternMatch = PATTERN_LINK.exec(url);
      if (patternMatch) {
        node.url = `/patterns/${patternMatch[1]}/${patternMatch[2] ?? ""}`;
        return;
      }
      node.url = url.endsWith("/")
        ? `${REPO_URL}/tree/main/${url.replace(/\/$/, "")}`
        : `${REPO_URL}/blob/main/${url}`;
    });
  };
}
