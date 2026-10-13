'use client';

import { Code } from '@omsoo.design/todae/code';
import type { ComponentProps } from 'react';
import { ScrollRegion } from './ScrollRegion';

export function DocsPre(props: ComponentProps<'pre'>) {
  return (
    <ScrollRegion kind="code" className="docs-pre">
      <Code.Block {...props} />
    </ScrollRegion>
  );
}
