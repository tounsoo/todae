import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageScrollbarIsFlush, releasePageScrollbar, releasePageScrollbarOnUnmount, syncPageScrollbar } from './pageScrollbar.js';

function setWidths(innerWidth: number, clientWidth: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => innerWidth });
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => clientWidth });
}

describe('page scrollbar lock', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-todae-no-page-scrollbar');
    vi.restoreAllMocks();
    setWidths(1024, 0);
  });

  it('is flush when the scrollbar takes no width', () => {
    expect(pageScrollbarIsFlush(390, 390)).toBe(true);
    expect(pageScrollbarIsFlush(1280, 1280)).toBe(true);
    expect(pageScrollbarIsFlush(390, 375)).toBe(false);
  });

  it('opts out of the gutter on a page whose scrollbar takes no width', () => {
    setWidths(390, 390);
    syncPageScrollbar(document);
    expect(document.documentElement.hasAttribute('data-todae-no-page-scrollbar')).toBe(true);
  });

  it('keeps the gutter on a page whose scrollbar takes width', () => {
    document.documentElement.setAttribute('data-todae-no-page-scrollbar', '');
    setWidths(390, 375);
    syncPageScrollbar(document);
    expect(document.documentElement.hasAttribute('data-todae-no-page-scrollbar')).toBe(false);
  });

  it('keeps a marker a newer open recorded after an unmount', async () => {
    setWidths(390, 390);
    const el = document.createElement('dialog');
    document.body.append(el);
    syncPageScrollbar(document);
    releasePageScrollbarOnUnmount(el);
    el.remove();
    syncPageScrollbar(document);
    await Promise.resolve();
    expect(document.documentElement.hasAttribute('data-todae-no-page-scrollbar')).toBe(true);
  });

  it('leaves the record alone while a modal dialog is open', () => {
    setWidths(390, 390);
    syncPageScrollbar(document);
    const dialog = document.createElement('dialog');
    const query = document.querySelector.bind(document);
    vi.spyOn(document, 'querySelector').mockImplementation((selector) => (selector === 'dialog:modal' ? dialog : query(selector)));
    setWidths(390, 375);
    syncPageScrollbar(document);
    releasePageScrollbar(document);
    expect(document.documentElement.hasAttribute('data-todae-no-page-scrollbar')).toBe(true);
    vi.mocked(document.querySelector).mockImplementation(query);
    releasePageScrollbar(document);
    expect(document.documentElement.hasAttribute('data-todae-no-page-scrollbar')).toBe(false);
  });
});
