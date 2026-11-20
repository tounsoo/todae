// Plain JavaScript: next.config.mjs loads it before TypeScript is compiled.
// Kept out of remarkPageContents so the MCP route can share heading ids
// without pulling the remark plugin, and its `../app/` URL, into the bundle.

/**
 * A heading's id, as GitHub writes one: lower case, punctuation dropped, spaces
 * as hyphens, with `-1`, `-2` and so on after a repeat. Letters of any script
 * stay, so a Korean heading gets a Korean id.
 */
export function slugOf(text, seen) {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .replace(/ /g, '-') || 'section';
  let slug = base;
  for (let n = 1; seen.has(slug); n++) slug = `${base}-${n}`;
  seen.add(slug);
  return slug;
}
