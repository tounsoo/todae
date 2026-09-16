import type { MDXComponents } from 'mdx/types';
import { Example } from './components/Example';
import { PropsTable } from './components/PropsTable';

const components = {
  Example,
  PropsTable,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
