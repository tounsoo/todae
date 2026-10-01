import type { ComponentProps } from 'react';
import type { MDXComponents } from 'mdx/types';
import { DocsPre } from './components/DocsPre';
import { Example } from './components/Example';
import { PropsTable } from './components/PropsTable';

function Table(props: ComponentProps<'table'>) {
  return (
    <div className="scroll-x">
      <table {...props} />
    </div>
  );
}

const components = {
  Example,
  PropsTable,
  pre: DocsPre,
  table: Table,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
