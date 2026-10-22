'use client';

import { ScrollArea } from '@tounsoo/todae';
import { PageContents, type PageSection } from './PageContents';

/** The column beside a page on wide screens. It scrolls on its own when the list is taller than the screen. */
export function PageContentsAside({ sections, label }: { sections: PageSection[]; label: string }) {
  return (
    <aside className="docs-contents">
      <ScrollArea.Root className="docs-contents-scroll" focusable={false}>
        <PageContents sections={sections} label={label} />
      </ScrollArea.Root>
    </aside>
  );
}
