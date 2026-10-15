import { DOCS_ORIGIN } from '../origin';
import { absolutize, pageBySlug } from './mdx';

const SOURCE = 'todae-docs' as const;

/** Docs pages about building on Todae that `get_guide` returns, by topic. */
export const GUIDES = {
  'build-on-todae': 'guides/build-on-todae',
  tokens: 'tokens',
  'css-layers': 'guides/css-layers',
  composition: 'composition',
  platform: 'platform',
  mcp: 'mcp',
} as const;

export type GuideTopic = keyof typeof GUIDES;

export const GUIDE_TOPICS = Object.keys(GUIDES) as [GuideTopic, ...GuideTopic[]];

/** The English page's MDX source, with links made absolute. */
export function getGuide(topic: GuideTopic) {
  const slug = GUIDES[topic];
  const page = pageBySlug(slug);
  if (!page) throw new Error(`No docs page for "${topic}"`);
  return {
    topic,
    title: page.title,
    markdown: absolutize(page.markdown),
    docsUrl: `${DOCS_ORIGIN}/${slug}`,
    source: SOURCE,
  };
}
