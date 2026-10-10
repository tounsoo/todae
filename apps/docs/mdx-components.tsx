import type { ComponentProps } from 'react';
import { Code } from '@omsoo/todae/code';
import { Kbd } from '@omsoo/todae/kbd';
import { Separator } from '@omsoo/todae/separator';
import { Table as TodaeTable } from '@omsoo/todae/table';
import type { MDXComponents } from 'mdx/types';
import { DocsPre } from './components/DocsPre';
import { Example } from './components/Example';
import { LocalizedLink } from './components/LocalizedLink';
import { ScrollRegion } from './components/OverflowRegion';
import { PropsTable } from './components/PropsTable';

function Table(props: ComponentProps<'table'>) {
  return (
    <ScrollRegion>
      <TodaeTable.Root {...props} />
    </ScrollRegion>
  );
}

const components = {
  a: LocalizedLink,
  code: Code.Root,
  hr: Separator.Root,
  kbd: Kbd.Root,
  LocalizedLink,
  Example,
  PropsTable,
  pre: DocsPre,
  table: Table,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
