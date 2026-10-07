'use client';

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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
  const peers = [...document.querySelectorAll<HTMLElement>(`[data-overflow-kind="${kind}"]`)].filter(
    (node) => nearestHeading(node) === heading,
  );
  if (peers.length < 2) return base;
  return `${base} ${peers.indexOf(el) + 1}`;
}

export function useOverflowRegion<T extends HTMLElement>(kind: Kind): {
  ref: RefObject<T | null>;
  focusable: boolean;
  label: string;
  onFocus: () => void;
  onBlur: () => void;
} {
  const ref = useRef<T>(null);
  const [overflows, setOverflows] = useState(false);
  const [focused, setFocused] = useState(false);
  const noun = DICTIONARIES[useLocale()].regions[kind];
  const [label, setLabel] = useState(noun);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setOverflows(el.scrollWidth > el.clientWidth);
      setLabel(regionLabel(el, noun, kind));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [kind, noun]);

  return {
    ref,
    focusable: overflows || focused,
    label,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}

export function ScrollRegion({ children }: { children: ReactNode }) {
  const region = useOverflowRegion<HTMLDivElement>('table');
  return (
    <div className="scroll-x">
      <div
        ref={region.ref}
        className="scroll-x-body"
        data-overflow-kind="table"
        tabIndex={region.focusable ? 0 : undefined}
        role={region.focusable ? 'region' : undefined}
        aria-label={region.focusable ? region.label : undefined}
        onFocus={region.onFocus}
        onBlur={region.onBlur}
      >
        {children}
      </div>
    </div>
  );
}
