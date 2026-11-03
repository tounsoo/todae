import remarkExamples from './remarkExamples.mjs';
import remarkPageContents from './remarkPageContents.mjs';
import remarkPageMetadata from './remarkPageMetadata.mjs';

// The docs pages' remark plugins, in order. remarkExamples runs before remarkPageContents
// wraps the page, so it sees each example at the top level, as the docs MCP does.
export const remarkPlugins = [remarkPageMetadata, remarkExamples, remarkPageContents];
