'use client';

import { CodeBlock } from '@tounsoo/todae/code-block';

const line = `const label = '${'token-'.repeat(12)}end';`;

export default function CodeBlockWrap() {
  return (
    <CodeBlock.Root wrap>
      <code>{line}</code>
    </CodeBlock.Root>
  );
}
