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

const pending: Partial<Record<AnnouncePoliteness, ReturnType<typeof setTimeout>>> = {};

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

function announce(message: string, options?: AnnounceOptions): void {
  const politeness = options?.politeness ?? 'polite';
  const live = region()?.querySelector<HTMLElement>(`[aria-live="${politeness}"]`);
  if (!live) return;
  clearTimeout(pending[politeness]);
  // Empty first, then write, so the same message twice is read twice.
  live.textContent = '';
  if (!message) return;
  pending[politeness] = setTimeout(() => {
    delete pending[politeness];
    // The page may have replaced body since; write to the region that is there now.
    const target = region()?.querySelector<HTMLElement>(`[aria-live="${politeness}"]`);
    if (target) target.textContent = message;
  }, WRITE_DELAY);
}

/**
 * Returns `announce(message, options?)`, which reads `message` to screen
 * readers through one visually hidden live region shared by the document.
 * The region is added when the first component using the hook mounts.
 */
export function useAnnouncer(): Announce {
  useEffect(() => {
    region();
  }, []);
  return announce;
}
