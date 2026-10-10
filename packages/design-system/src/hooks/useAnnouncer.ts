import { useEffect } from 'react';
import { frontModal } from '../overlay/modalStack';

export type AnnouncePoliteness = 'polite' | 'assertive';

export type AnnounceOptions = {
  /** `assertive` interrupts what the screen reader is saying. Default `polite`. */
  politeness?: AnnouncePoliteness;
};

export type Announce = (message: string, options?: AnnounceOptions) => void;

const ATTR = 'data-todae-announcer';
/** Long enough for a screen reader to see the region empty before the message lands. */
const WRITE_DELAY = 100;
/** How long a region must settle before a write lands anyway. */
const DEADLINE = 1000;
/** How long a write waits for a modal in its exit motion to close. */
const EXIT_LIMIT = 10_000;
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

// The pending write's timer per politeness, kept on globalThis so every copy
// of the package shares "a newer message replaces a pending one".
type Pending = Partial<Record<AnnouncePoliteness, ReturnType<typeof setTimeout>>>;
const PENDING = Symbol.for('todae.announcer.pending');

function pendingWrites(): Pending {
  const scope = globalThis as unknown as Record<symbol, Pending | undefined>;
  return (scope[PENDING] ??= {});
}

/**
 * The region that is a direct child of host, created on request. Body has
 * one, and so does each modal dialog a message was read in. Regions are
 * never moved.
 */
function regionIn(host: HTMLElement, create: boolean): HTMLElement | null {
  const existing = host.querySelector<HTMLElement>(`:scope > [${ATTR}]`);
  if (existing || !create) return existing;
  const root = document.createElement('div');
  root.setAttribute(ATTR, '');
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
  const pending = pendingWrites();
  clearTimeout(pending[politeness]);
  delete pending[politeness];
  // Empty first, then write, so the same message twice is read twice. This
  // also empties regions left in dialogs that have since closed.
  for (const live of document.querySelectorAll<HTMLElement>(`[${ATTR}] > [aria-live="${politeness}"]`)) {
    live.textContent = '';
  }
  if (!message) return;
  const start = performance.now();
  const schedule = () => {
    pending[politeness] = setTimeout(attempt, WRITE_DELAY);
  };
  // A modal makes the rest of the page inert, so the region read is the one
  // in the modal in front of Todae's modal stack, or in body when none is
  // open. A modal stays in the stack until close(), so one in its exit
  // motion (data-exiting) picks none yet: a message written there would be
  // hidden with it a moment later, and the rest of the page is still inert.
  // One that exits for too long is taken as it is: still open, and the only
  // part of the page that is not inert.
  const target = (now: number): HTMLElement | null => {
    const modal = frontModal();
    if (modal?.hasAttribute('data-exiting') && now < start + EXIT_LIMIT) return null;
    return modal ?? document.body;
  };
  // Write only into the region the last check also picked: one that was
  // just created, or whose dialog just opened, closed or reopened, first
  // sits reachable and empty for a moment so it is read. Past the deadline,
  // one more moment at most.
  const host = target(start);
  let chosen = host && regionIn(host, false);
  let grace = true;
  function attempt() {
    const now = performance.now();
    const late = now >= start + DEADLINE;
    const host = target(now);
    const root = host && regionIn(host, true);
    if (!root || (root !== chosen && (!late || grace))) {
      if (late && root) grace = false;
      chosen = root;
      return schedule();
    }
    delete pending[politeness];
    const live = root.querySelector<HTMLElement>(`[aria-live="${politeness}"]`);
    if (live) live.textContent = message;
  }
  schedule();
}

/**
 * Returns `announce(message, options?)`, which reads `message` to screen
 * readers through visually hidden polite and assertive live regions shared
 * by the document.
 * The region is added when the first component using the hook mounts. While
 * a modal in Todae's modal stack is open, messages are read from inside the
 * one in front.
 */
export function useAnnouncer(): Announce {
  useEffect(() => {
    regionIn(document.body, true);
  }, []);
  return announce;
}
