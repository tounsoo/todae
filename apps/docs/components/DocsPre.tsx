'use client';

import { Code } from '@tounsoo/todae/code';
import type { ComponentProps } from 'react';
import { ScrollRegion } from './ScrollRegion';

export function DocsPre(props: ComponentProps<'pre'>) {
  return (
    <ScrollRegion kind="code" className="docs-pre">
      <Code.Root as="pre" {...props} />
    </ScrollRegion>
  );
}
