import createMDX from '@next/mdx';

const nextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  outputFileTracingIncludes: {
    '/api/[transport]': ['./app/**/page.mdx'],
  },
};

export default createMDX()(nextConfig);
