import createMDX from '@next/mdx';

// The non-default locales in lib/i18n/config.ts, as URL prefixes.
const LOCALE_PREFIXES = ['/ko'];

const REDIRECTS = [['/combobox', '/recipes/combobox']];

const nextConfig = {
  // Each locale has its own root layout (app/(en), app/ko), so a 404 needs a page with its own <html>.
  experimental: { globalNotFound: true },
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  outputFileTracingIncludes: {
    // The MCP reads English pages only. Parentheses are glob syntax, so escape the route group.
    '/api/[transport]': ['./app/\\(en\\)/**/page.mdx'],
  },
  // Every English redirect also applies under each locale prefix.
  redirects: async () =>
    REDIRECTS.flatMap(([source, destination]) =>
      ['', ...LOCALE_PREFIXES].map((prefix) => ({ source: prefix + source, destination: prefix + destination, permanent: true })),
    ),
};

export default createMDX()(nextConfig);
