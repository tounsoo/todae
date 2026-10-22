import { Prose } from '@tounsoo/todae/prose';
import type { ReactNode } from 'react';

/** A page's content set by Prose.Root: every MDX page's, inside DocsPage, and the 404's. */
export function DocsProse({ children }: { children?: ReactNode }) {
  return <Prose.Root className="docs-prose">{children}</Prose.Root>;
}
