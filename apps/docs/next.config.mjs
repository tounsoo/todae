import createMDX from '@next/mdx';
import remarkPageMetadata from './lib/remarkPageMetadata.mjs';

// The non-default locales in lib/i18n/config.ts, as URL prefixes.
const LOCALE_PREFIXES = ['/ko'];

const REDIRECTS = [
  ['/combobox', '/recipes/combobox'],
  ['/recipes/chip-list', '/chip-list'],
  ['/field/date-input', '/field/date-picker'],
  ['/field/time-input', '/field/time-picker'],
];

// Vercel names the project's production domain in every deployment, previews included.
// `env` inlines it at build, so client components read the same origin as the server.
const PRODUCTION_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL;

const nextConfig = {
  env: { DOCS_ORIGIN: PRODUCTION_HOST ? `https://${PRODUCTION_HOST}` : '' },
  // Each locale has its own root layout (app/(en), app/ko), so a 404 needs a page with its own <html>.
  // Lightning CSS compiles Todae's CSS Modules: Next's default compiler leaves the class in
  // Prose.module.css's @scope rule unrenamed. It lowers CSS for the browsers in package.json's browserslist,
  // which reaches back to Safari 18 so Lightning keeps -webkit-box-decoration-break: Safari still ships
  // only the prefixed form, and Lightning drops the prefix for newer Safari.
  experimental: { globalNotFound: true, useLightningcss: true },
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  outputFileTracingIncludes: {
    // The MCP reads English pages only.
    '/api/[transport]': ['./app/(en)/**/page.mdx'],
  },
  // Every English redirect also applies under each locale prefix.
  redirects: async () =>
    REDIRECTS.flatMap(([source, destination]) =>
      ['', ...LOCALE_PREFIXES].map((prefix) => ({ source: prefix + source, destination: prefix + destination, permanent: true })),
    ),
};

// Every MDX page exports metadata from its own title and first paragraph.
export default createMDX({ options: { remarkPlugins: [remarkPageMetadata] } })(nextConfig);
