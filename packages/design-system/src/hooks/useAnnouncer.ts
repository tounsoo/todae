import { useEffect } from 'react';
import { frontModalElement } from '../overlay/modalStack';

export type AnnouncePoliteness = 'polite' | 'assertive';

export type AnnounceOptions = {
  /** `assertive` interrupts what the screen reader is saying. Default `polite`. */
  politeness?: AnnouncePoliteness;
};

export type Announce = (message: string, options?: AnnounceOptions) => void;

const ATTR = 'data-todae-announcer';
/** Long enough for a screen reader to see the region empty before the message lands. */
const WRITE_DELAY = 100;
/** How long a write waits for a closing modal, or for a new region to settle. */
const DEADLINE = 1000;
// The visually hidden styles, set from script so a strict CSP allows them and
// the region stays hidden even without Todae's CSS.
const HIDDEN: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: '0',
  border: '0',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
};

// The pending write's timer id per politeness, on <html>, so every copy of
// the package shares "a newer message replaces a pending one", and a region
// removed from the page cannot hold on to a stale write.
const PENDING: Record<AnnouncePoliteness, string> = {
  polite: 'todaeAnnouncePolite',
  assertive: 'todaeAnnounceAssertive',
};

/**
 * The region that is a direct child of host, created on request. Body has
 * one, and so does each modal dialog a message was read in; regions are
 * never moved, so none is a fresh live region at the moment it is written.
 */
function regionIn(host: HTMLElement, create: boolean): HTMLElement | null {
  const existing = host.querySelector<HTMLElement>(`:scope > [${ATTR}]`);
  if (existing || !create) return existing;
  const root = document.createElement('div');
  root.setAttribute(ATTR, '');
  root.className = 'todae-visually-hidden';
  Object.assign(root.style, HIDDEN);
  for (const politeness of ['polite', 'assertive'] as const) {
    const live = document.createElement('div');
    live.setAttribute('aria-live', politeness);
    live.setAttribute('aria-atomic', 'true');
    root.append(live);
  }
  host.append(root);
  return root;
}

function announce(message: string, options?: AnnounceOptions): void {
  if (typeof document === 'undefined' || !document.body) return;
  const politeness = options?.politeness ?? 'polite';
  const html = document.documentElement;
  const key = PENDING[politeness];
  clearTimeout(Number(html.dataset[key]));
  delete html.dataset[key];
  // Empty first, then write, so the same message twice is read twice. This
  // also empties regions left in dialogs that have since closed.
  for (const live of document.querySelectorAll<HTMLElement>(`[${ATTR}] > [aria-live="${politeness}"]`)) {
    live.textContent = '';
  }
  if (!message) return;
  const deadline = Date.now() + DEADLINE;
  const schedule = () => {
    html.dataset[key] = String(setTimeout(attempt, WRITE_DELAY));
  };
  // The host is chosen when the message is written: a modal makes the rest
  // of the page inert, so the region read is the one in the modal in front,
  // or in body when none is open.
  function attempt() {
    const late = Date.now() >= deadline;
    const modal = frontModalElement();
    // A modal in its exit motion keeps the page inert until it closes.
    if (modal?.hasAttribute('data-exiting') && !late) return schedule();
    const host = modal ?? document.body;
    const existing = regionIn(host, false);
    const root = existing ?? regionIn(host, true)!;
    // A new region sits empty for a moment first, so it is read.
    if (!existing && !late) return schedule();
    delete html.dataset[key];
    const live = root.querySelector<HTMLElement>(`[aria-live="${politeness}"]`);
    if (live) live.textContent = message;
  }
  schedule();
}

/**
 * Returns `announce(message, options?)`, which reads `message` to screen
 * readers through one visually hidden live region shared by the document.
 * The region is added when the first component using the hook mounts. While
 * a modal dialog is open, messages are read from inside the one in front.
 */
export function useAnnouncer(): Announce {
  useEffect(() => {
    regionIn(document.body, true);
  }, []);
  return announce;
}
