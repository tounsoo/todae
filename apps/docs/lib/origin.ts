/**
 * Where the docs are deployed, with no trailing slash. next.config.mjs sets it
 * from Vercel's production domain, which previews get too, so canonical URLs
 * and link previews always name the live site. Elsewhere, such as in tests and
 * local builds, it is the dev server.
 */
export const DOCS_ORIGIN = process.env.DOCS_ORIGIN || 'http://localhost:3000';
