import { fileURLToPath } from 'node:url';
import createMDX from '@next/mdx';
import remarkPageContents from './lib/remarkPageContents.mjs';
import remarkPageMetadata from './lib/remarkPageMetadata.mjs';

// The non-default locales in lib/i18n/config.ts, as URL prefixes.
const LOCALE_PREFIXES = ['/ko'];

const REDIRECTS = [
  ['/combobox', '/recipes/combobox'],
  ['/recipes/chip-list', '/chip-list'],
  ['/field/date-input', '/field/date-picker'],
  ['/field/time-input', '/field/time-picker'],
  ['/field/date-time-input', '/field/date-time-picker'],
  ['/spinner', '/loader'],
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
  // tsconfig paths point the package at its source, whose relative imports name the emitted .js
  // files. The alias is scoped to that source, so dependencies resolve as they publish.
  webpack: (config) => {
    config.module.rules.push({
      include: fileURLToPath(new URL('../../packages/design-system/src', import.meta.url)),
      resolve: { extensionAlias: { '.js': ['.ts', '.tsx', '.js'] } },
    });
    return config;
  },
  outputFileTracingIncludes: {
    // The MCP reads English pages only, builds company tokens on Todae's token files with its CLI, and reads the changelog.
    '/api/[transport]': [
      '../../packages/design-system/CHANGELOG.md',
      './app/(en)/**/page.mdx',
      '../../packages/design-system/tokens/**/*.json',
      '../../packages/design-system/dist/scripts/**/*.js',
    ],
  },
  // Every English redirect also applies under each locale prefix.
  redirects: async () =>
    REDIRECTS.flatMap(([source, destination]) =>
      ['', ...LOCALE_PREFIXES].map((prefix) => ({ source: prefix + source, destination: prefix + destination, permanent: true })),
    ),
};

// Every MDX page exports metadata from its own title and first paragraph, and lists its sections.
export default createMDX({ options: { remarkPlugins: [remarkPageMetadata, remarkPageContents] } })(nextConfig);
