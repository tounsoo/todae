import { afterEach, describe, expect, it } from 'vitest';
import { installScrollLock } from './scrollLock.js';

const GUTTER = '--_todae-scroll-lock-gutter';

installScrollLock();

function gutter(): string {
  return document.documentElement.style.getPropertyValue(GUTTER);
}

function setGap(inner: number, client: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => inner });
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => client });
}

function dialog(): HTMLDialogElement {
  const el = document.createElement('dialog');
  document.body.append(el);
  return el;
}

afterEach(() => {
  for (const el of [...document.querySelectorAll('dialog')]) {
    const node = el as HTMLDialogElement;
    if (node.open) node.close();
    node.remove();
  }
  document.documentElement.style.removeProperty(GUTTER);
  Reflect.deleteProperty(document.documentElement, 'clientWidth');
});

describe('scroll lock gutter', () => {
  it('does not reserve a gutter when the page has no scrollbar, and clears it on close', () => {
    setGap(390, 390);
    const el = dialog();
    el.showModal();
    expect(gutter()).toBe('auto');
    el.close();
    expect(gutter()).toBe('');
  });

  it('reserves a gutter when the page has a scrollbar, and clears it on close', () => {
    setGap(390, 375);
    const el = dialog();
    el.showModal();
    expect(gutter()).toBe('stable');
    el.close();
    expect(gutter()).toBe('');
  });

  it('measures once when a second modal opens from inside the first showModal', () => {
    setGap(390, 375);
    const first = dialog();
    const second = dialog();
    let nested = false;
    Object.defineProperty(first, 'open', {
      configurable: true,
      get() {
        return this.hasAttribute('open');
      },
      set(value: boolean) {
        if (value) this.setAttribute('open', '');
        else this.removeAttribute('open');
        if (value && !nested) {
          nested = true;
          setGap(390, 390);
          second.showModal();
        }
      },
    });
    first.showModal();
    expect(gutter()).toBe('stable');
    first.close();
    expect(gutter()).toBe('stable');
    second.close();
    expect(gutter()).toBe('');
  });

  it('restores the inline value when a dialog is removed without close()', () => {
    document.documentElement.style.setProperty(GUTTER, 'stable');
    setGap(390, 390);
    const first = dialog();
    first.showModal();
    expect(gutter()).toBe('auto');
    first.remove();
    setGap(390, 375);
    const second = dialog();
    second.showModal();
    expect(gutter()).toBe('stable');
    second.close();
    expect(gutter()).toBe('stable');
  });

  it('keeps the decision until the last of two modals closes, then restores the inline value', () => {
    document.documentElement.style.setProperty(GUTTER, 'stable');
    setGap(390, 390);
    const first = dialog();
    const second = dialog();
    first.showModal();
    second.showModal();
    expect(gutter()).toBe('auto');
    first.close();
    expect(gutter()).toBe('auto');
    second.close();
    expect(gutter()).toBe('stable');
  });
});
