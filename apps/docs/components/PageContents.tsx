'use client';

import { Contents } from '@tounsoo/todae';
import type { ReactNode } from 'react';

/** One `##` section of a page, with the `###` sections under it, as `remarkPageContents` lists them. */
export type PageSection = { id: string; text: string; children: PageSection[] };

function items(sections: PageSection[]): ReactNode {
  return sections.map((section) => (
    <Contents.Item key={section.id}>
      <Contents.Link href={`#${section.id}`}>{section.text}</Contents.Link>
      {section.children.length > 0 ? <Contents.List>{items(section.children)}</Contents.List> : null}
    </Contents.Item>
  ));
}

/** A page's sections as a Contents list. A client module, since Contents comes from the main entry. */
export function PageContents({ sections, label, ariaLabel }: { sections: PageSection[]; label?: string; ariaLabel?: string }) {
  return (
    <Contents.Root label={label} aria-label={ariaLabel}>
      {items(sections)}
    </Contents.Root>
  );
}
