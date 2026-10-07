import createMDX from '@next/mdx';

const nextConfig = {
  // Each locale has its own root layout (app/(en), app/ko), so a 404 needs a page with its own <html>.
  experimental: { globalNotFound: true },
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  outputFileTracingIncludes: {
    '/api/[transport]': ['./app/**/page.mdx'],
  },
  redirects: async () => [{ source: '/combobox', destination: '/recipes/combobox', permanent: true }],
};

export default createMDX()(nextConfig);
