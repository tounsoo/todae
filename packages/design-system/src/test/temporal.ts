// The full build, so non-ISO calendars such as Japanese work as in a browser's own Temporal.
import { Temporal } from 'temporal-polyfill/full';

// Node, jsdom and the pinned Chromium have no Temporal yet.
if (typeof globalThis.Temporal === 'undefined') {
  Object.defineProperty(globalThis, 'Temporal', {
    value: Temporal as unknown as typeof globalThis.Temporal,
    configurable: true,
    writable: true,
  });
}
