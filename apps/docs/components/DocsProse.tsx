import { Prose } from '@omsoo/todae/prose';
import type { ReactNode } from 'react';

/** Every MDX page's content, and the 404's, set by Prose.Root. MDX hands its wrapper a `components` prop, which a div must not get. */
export function DocsProse({ children }: { children?: ReactNode }) {
  return <Prose.Root className="docs-prose">{children}</Prose.Root>;
}
