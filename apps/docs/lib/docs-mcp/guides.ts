import { readPage, type ReadOptions } from './read';

/** Docs pages about building on Todae that `get_guide` returns, by topic. */
export const GUIDES = {
  'get-started': 'guides/get-started',
  'build-on-todae': 'guides/build-on-todae',
  tokens: 'tokens',
  'css-layers': 'guides/css-layers',
  composition: 'composition',
  platform: 'platform',
  mcp: 'mcp',
} as const;

export type GuideTopic = keyof typeof GUIDES;

export const GUIDE_TOPICS = Object.keys(GUIDES) as [GuideTopic, ...GuideTopic[]];

/** A guide page. Same reads as get_docs_page: section and example stubs. */
export function getGuide(topic: GuideTopic, options?: ReadOptions) {
  const page = readPage(GUIDES[topic], options);
  return { topic, ...page };
}
