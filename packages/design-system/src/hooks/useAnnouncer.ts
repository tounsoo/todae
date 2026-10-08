import { useEffect } from 'react';

export type AnnouncePoliteness = 'polite' | 'assertive';

export type AnnounceOptions = {
  /** `assertive` interrupts what the screen reader is saying. Default `polite`. */
  politeness?: AnnouncePoliteness;
};

export type Announce = (message: string, options?: AnnounceOptions) => void;

const ATTR = 'data-todae-announcer';
/** Long enough for a screen reader to see the region empty before the message lands. */
const WRITE_DELAY = 100;

// The pending write's timer id lives on the live element, so every copy of
// the package that shares the region also shares the "newer replaces
// pending" rule. Timer ids are per window, not per copy.
const PENDING = 'todaePending';

/** The document's one announcer, found by attribute so every copy of the package shares it. */
function region(): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  const existing = document.querySelector<HTMLElement>(`[${ATTR}]`);
  if (existing) return existing;
  const root = document.createElement('div');
  root.setAttribute(ATTR, '');
  root.className = 'todae-visually-hidden';
  for (const politeness of ['polite', 'assertive'] as const) {
    const live = document.createElement('div');
    live.setAttribute('aria-live', politeness);
    live.setAttribute('aria-atomic', 'true');
    root.append(live);
  }
  document.body.append(root);
  return root;
}

// A modal dialog makes everything outside it inert, so the region has to sit
// inside the last open modal dialog to be read. Otherwise it sits in body.
function host(): HTMLElement {
  let modals: NodeListOf<HTMLElement> | [] = [];
  try {
    modals = document.querySelectorAll<HTMLElement>('dialog:modal');
  } catch {
    // An engine without :modal has no inert page to escape.
  }
  return modals[modals.length - 1] ?? document.body;
}

function announce(message: string, options?: AnnounceOptions): void {
  const politeness = options?.politeness ?? 'polite';
  const root = region();
  const live = root?.querySelector<HTMLElement>(`[aria-live="${politeness}"]`);
  if (!root || !live) return;
  const there = host();
  if (root.parentElement !== there) there.append(root);
  clearTimeout(Number(live.dataset[PENDING]));
  delete live.dataset[PENDING];
  // Empty first, then write, so the same message twice is read twice.
  live.textContent = '';
  if (!message) return;
  const id = setTimeout(() => {
    if (live.dataset[PENDING] === String(id)) delete live.dataset[PENDING];
    // The region was removed meanwhile (say, body replaced): start over, so
    // the new region is in the page empty before the message lands.
    if (!live.isConnected) {
      announce(message, options);
      return;
    }
    live.textContent = message;
  }, WRITE_DELAY);
  live.dataset[PENDING] = String(id);
}

/**
 * Returns `announce(message, options?)`, which reads `message` to screen
 * readers through one visually hidden live region shared by the document.
 * The region is added when the first component using the hook mounts, and
 * moves into the last open modal dialog while one is open.
 */
export function useAnnouncer(): Announce {
  useEffect(() => {
    region();
  }, []);
  return announce;
}
