// Plain JavaScript: next.config.mjs, its MDX plugin and its webpack loader load it before TypeScript is compiled.

/**
 * The code a docs page shows for an example file: the file as written, without the
 * `'use client'` directive the docs site needs to render it from a Server Component.
 */
export function exampleSource(text) {
  return text.replace(/^'use client';\n+/, '').trimEnd();
}
