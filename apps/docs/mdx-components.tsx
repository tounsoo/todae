import { Code } from '@tounsoo/todae/code';
import { Kbd } from '@tounsoo/todae/kbd';
import { Separator } from '@tounsoo/todae/separator';
import type { MDXComponents } from 'mdx/types';
import { DocsPre } from './components/DocsPre';
import { DocsProse } from './components/DocsProse';
import { Example } from './components/Example';
import { LocalizedLink } from './components/LocalizedLink';
import { PropsTable } from './components/PropsTable';

const components = {
  a: LocalizedLink,
  code: Code.Root,
  hr: Separator.Root,
  kbd: Kbd.Root,
  LocalizedLink,
  Example,
  PropsTable,
  pre: DocsPre,
  wrapper: DocsProse,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
