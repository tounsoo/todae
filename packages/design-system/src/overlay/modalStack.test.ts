import { describe, expect, it } from 'vitest';
import { isModal } from './modalStack';

describe('isModal', () => {
  it('reads aria-modal without matching :modal where the engine has no :modal', () => {
    // jsdom has no :modal, and matching it there overflows the call stack.
    const el = document.createElement('dialog');
    const asked: string[] = [];
    el.matches = ((selector: string) => {
      asked.push(selector);
      return false;
    }) as Element['matches'];
    el.setAttribute('aria-modal', 'true');
    expect(isModal(el)).toBe(true);
    el.removeAttribute('aria-modal');
    expect(isModal(el)).toBe(false);
    expect(asked).toEqual([]);
  });
});
