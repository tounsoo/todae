import { Temporal } from 'temporal-polyfill';

// Node 22, jsdom and the pinned Chromium have no Temporal yet. Tests only: Todae itself
// ships no polyfill, so an app brings Temporal from the browser or its own polyfill.
if (typeof globalThis.Temporal === 'undefined') {
  Object.defineProperty(globalThis, 'Temporal', {
    value: Temporal as unknown as typeof globalThis.Temporal,
    configurable: true,
    writable: true,
  });
}
