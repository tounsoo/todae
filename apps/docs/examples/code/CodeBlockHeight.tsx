'use client';

import { CodeBlock, ScrollArea } from '@tounsoo/todae';

const source = [
  `const label = '${'token-'.repeat(8)}end';`,
  ...Array.from({ length: 24 }, (_, index) => `const line${index + 1} = ${index + 1};`),
].join('\n');

export default function CodeBlockHeight() {
  return (
    <ScrollArea.Root focusable axis="both" aria-label="Long source" style={{ maxBlockSize: '8rem' }}>
      <CodeBlock.Root style={{ overflow: 'visible' }}>
        <code>{source}</code>
      </CodeBlock.Root>
    </ScrollArea.Root>
  );
}
