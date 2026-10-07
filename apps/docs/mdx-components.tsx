import type { ComponentProps } from 'react';
import type { MDXComponents } from 'mdx/types';
import { DocsPre } from './components/DocsPre';
import { Example } from './components/Example';
import { LocalizedLink } from './components/LocalizedLink';
import { ScrollRegion } from './components/OverflowRegion';
import { PropsTable } from './components/PropsTable';

function Table(props: ComponentProps<'table'>) {
  return (
    <ScrollRegion>
      <table {...props} />
    </ScrollRegion>
  );
}

const components = {
  a: LocalizedLink,
  LocalizedLink,
  Example,
  PropsTable,
  pre: DocsPre,
  table: Table,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
