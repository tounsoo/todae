import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import createMDX from '@next/mdx';
import { remarkPlugins } from './lib/remarkPlugins.mjs';
import { stableBuild } from './lib/stableBuild.mjs';

// The non-default locales in lib/i18n/config.ts, as URL prefixes.
const LOCALE_PREFIXES = ['/ko'];

const REDIRECTS = [
  ['/combobox', '/recipes/combobox'],
  ['/recipes/chip-list', '/chip-list'],
  ['/field/date-picker', '/field/date-input'],
  ['/field/time-picker', '/field/time-input'],
  ['/field/date-time-picker', '/field/date-time-input'],
  ['/field/date-range-picker', '/field/date-range-input'],
  ['/field/color-picker', '/field/picker'],
  ['/spinner', '/loader'],
  ['/composer', '/recipes/chat-composer-mentions'],
  ['/utilities/use-controlled-value', '/utilities/use-controlled-state'],
];

// Every response, pages and the MCP endpoint alike: no MIME sniffing, no framing by another site, no <base> or
// plugin content, and only the origin in a referrer sent to another site. A script-src would need hashes for
// SiteShell's two inline appearance scripts, so the policy leaves scripts alone.
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

// Vercel names the project's production domain in every deployment, previews included.
// `env` inlines it at build, so client components read the same origin as the server.
const PRODUCTION_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// Next stamps the build id into every prerendered page. The commit's id lets a rebuild of the same commit write
// the same pages. Outside a git checkout, null lets Next pick a random one.
function commitId() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

const nextConfig = {
  generateBuildId: commitId,
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
  webpack: (config, { dev }) => {
    config.module.rules.push({ test: /\.mdx$/, enforce: 'pre', use: [fileURLToPath(new URL('./lib/exampleDependencyLoader.mjs', import.meta.url))] });
    config.module.rules.push({
      include: fileURLToPath(new URL('../../packages/design-system/src', import.meta.url)),
      resolve: { extensionAlias: { '.js': ['.ts', '.tsx', '.js'] } },
    });
    // Two builds of the same code would otherwise differ in about a thousand files. Dev writes nothing to deploy.
    return dev ? config : stableBuild(config);
  },
  outputFileTracingIncludes: {
    // The MCP reads English pages only, with the example files and stylesheets they show, builds company tokens on Todae's token
    // files with its CLI, and reads the changelog. The CLI in dist/scripts imports the shared color math from dist/src/color.
    '/api/[transport]': [
      '../../packages/design-system/CHANGELOG.md',
      './app/(en)/**/page.mdx',
      './examples/**/*.tsx',
      './examples/**/*.module.css',
      '../../packages/design-system/tokens/**/*.json',
      '../../packages/design-system/dist/scripts/**/*.js',
      '../../packages/design-system/dist/src/color/*.js',
    ],
  },
  headers: async () => [{ source: '/:path*', headers: SECURITY_HEADERS }],
  // Every English redirect also applies under each locale prefix.
  redirects: async () =>
    REDIRECTS.flatMap(([source, destination]) =>
      ['', ...LOCALE_PREFIXES].map((prefix) => ({ source: prefix + source, destination: prefix + destination, permanent: true })),
    ),
};

// Every MDX page exports metadata from its own title and first paragraph, and lists its sections.
export default createMDX({ options: { remarkPlugins } })(nextConfig);
