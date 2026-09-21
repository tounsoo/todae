import type { MDXComponents } from 'mdx/types';
import { Example } from './components/Example';
import { PropsTable } from './components/PropsTable';
import { WhenToUse } from './components/WhenToUse';

const components = {
  Example,
  PropsTable,
  WhenToUse,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
