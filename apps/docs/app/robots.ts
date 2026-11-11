import type { MetadataRoute } from 'next';
import { DOCS_ORIGIN } from '../lib/origin';

/** Every page is open to crawlers. The MCP endpoint under /api is for agents, not search results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${DOCS_ORIGIN}/sitemap.xml`,
  };
}
