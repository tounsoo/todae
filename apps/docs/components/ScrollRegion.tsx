'use client';

import { ScrollArea } from '@tounsoo/todae';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { useLocale } from '../lib/i18n/useLocale';

type Kind = 'code' | 'table';

function nearestHeading(el: HTMLElement): string {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let found = '';
  for (const heading of headings) {
    if ((el.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_PRECEDING) === 0) break;
    found = (heading.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  return found;
}

function regionLabel(el: HTMLElement, noun: string, kind: Kind): string {
  const heading = nearestHeading(el);
  const base = heading ? `${noun}, ${heading}` : noun;
  const peers = [...document.querySelectorAll<HTMLElement>(`[data-scroll-kind="${kind}"]`)].filter(
    (node) => nearestHeading(node) === heading,
  );
  if (peers.length < 2) return base;
  return `${base} ${peers.indexOf(el) + 1}`;
}

/**
 * A sideways ScrollArea.Root for a code block or table. It takes a Tab stop while it overflows, even when a link
 * inside could take focus, since tabbing to a link at the start never scrolls to the end. Its name is the kind and
 * the nearest heading before it, numbered when several share that heading.
 */
export function ScrollRegion({ kind = 'table', className, children }: { kind?: Kind; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const noun = DICTIONARIES[useLocale()].regions[kind];
  const [label, setLabel] = useState(noun);

  useLayoutEffect(() => {
    if (ref.current) setLabel(regionLabel(ref.current, noun, kind));
  }, [kind, noun]);

  return (
    <ScrollArea.Root ref={ref} axis="inline" focusable aria-label={label} data-scroll-kind={kind} className={className ?? 'scroll-x'}>
      {children}
    </ScrollArea.Root>
  );
}
