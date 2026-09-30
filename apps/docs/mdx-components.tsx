import type { ComponentProps } from 'react';
import type { MDXComponents } from 'mdx/types';
import { Example } from './components/Example';
import { PropsTable } from './components/PropsTable';

function Pre(props: ComponentProps<'pre'>) {
  return (
    <div className="docs-pre">
      <pre {...props} tabIndex={0} />
    </div>
  );
}

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
  pre: Pre,
  table: Table,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
