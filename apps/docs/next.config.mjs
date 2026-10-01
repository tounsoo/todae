import createMDX from '@next/mdx';

const nextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  outputFileTracingIncludes: {
    '/api/[transport]': ['./app/**/page.mdx'],
  },
  redirects: async () => [{ source: '/combobox', destination: '/recipes/combobox', permanent: true }],
};

export default createMDX()(nextConfig);
