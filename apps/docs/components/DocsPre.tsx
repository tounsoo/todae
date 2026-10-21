'use client';

import { CodeBlock } from '@tounsoo/todae/code-block';
import type { ComponentProps } from 'react';
import { ScrollRegion } from './ScrollRegion';

export function DocsPre(props: ComponentProps<'pre'>) {
  return (
    <ScrollRegion kind="code" className="docs-pre">
      <CodeBlock.Root {...props} />
    </ScrollRegion>
  );
}
