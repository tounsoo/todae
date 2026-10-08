import { describe, expect, it } from 'vitest';
import { getTabbables, TOAST_HOST_ATTRIBUTE } from './tabbables';

describe('getTabbables', () => {
  it('skips toasts moved into the root, wherever they sit among its own content', () => {
    const root = document.createElement('dialog');
    root.innerHTML = `<button id="own1"></button><div ${TOAST_HOST_ATTRIBUTE}><button id="toast"></button></div><button id="own2"></button>`;
    document.body.append(root);
    expect(getTabbables(root).map((el) => el.id)).toEqual(['own1', 'own2']);
    // Searching from inside a toast still finds its own controls.
    const toast = root.querySelector<HTMLElement>(`[${TOAST_HOST_ATTRIBUTE}]`)!;
    expect(getTabbables(toast).map((el) => el.id)).toEqual(['toast']);
    root.remove();
  });
});
