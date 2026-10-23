// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HTML_APPEARANCE_SCRIPT } from './appearanceScript';
import { Providers } from './Providers';
import { ThemeSwitcher } from './ThemeSwitcher';

beforeEach(() => {
  window.localStorage.clear();
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-appearance');
});

function renderSite() {
  const { container } = render(
    <Providers>
      <ThemeSwitcher locale="en" />
    </Providers>,
  );
  return () => container.querySelector('.shell')?.getAttribute('data-appearance');
}

describe('ThemeSwitcher', () => {
  it('follows the system until the reader picks, then keeps the pick', () => {
    const appearance = renderSite();
    expect(appearance()).toBe('system');
    expect(document.documentElement.getAttribute('data-appearance')).toBe('system');
    expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(appearance()).toBe('dark');
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dark');
    expect(window.localStorage.getItem('todae-docs-appearance')).toBe('dark');
    cleanup();
    document.documentElement.removeAttribute('data-appearance');
    expect(renderSite()()).toBe('dark');
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dark');
  });

  it('keeps a choice when the pressed item is pressed again', () => {
    const appearance = renderSite();
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(appearance()).toBe('light');
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps a stored pick on the document element through hydration', async () => {
    window.localStorage.setItem('todae-docs-appearance', 'dark');
    document.documentElement.setAttribute('data-appearance', 'system');
    const script = document.createElement('script');
    script.textContent = HTML_APPEARANCE_SCRIPT;
    document.head.append(script);
    script.remove();
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dark');

    const element = (
      <Providers>
        <span>mark</span>
      </Providers>
    );
    const host = document.createElement('div');
    host.innerHTML = renderToString(element);
    document.body.append(host);
    const writes: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        writes.push((record.target as Element).getAttribute('data-appearance') ?? '');
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-appearance'] });
    const root = hydrateRoot(host, element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer.disconnect();
    root.unmount();

    expect(writes).not.toContain('system');
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dark');
  });

  it('ignores a stored value it does not know', () => {
    window.localStorage.setItem('todae-docs-appearance', 'sepia');
    renderSite();
    expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('true');
  });

  for (const [label, readBlocked] of [
    ['reads and writes are', true],
    ['only writes are', false],
  ] as const) {
    it(`still switches when ${label} blocked`, () => {
      const blocked = () => {
        throw new DOMException('Blocked', 'QuotaExceededError');
      };
      const getItem = readBlocked ? vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked) : null;
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
      try {
        const appearance = renderSite();
        expect(appearance()).toBe('system');
        fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
        expect(appearance()).toBe('dark');
        expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true');
      } finally {
        getItem?.mockRestore();
        setItem.mockRestore();
        // Once storage takes a pick again, it wins over the page-load fallback.
        fireEvent.click(screen.getByRole('button', { name: 'Light' }));
      }
      expect(window.localStorage.getItem('todae-docs-appearance')).toBe('light');
      expect(document.querySelector('.shell')?.getAttribute('data-appearance')).toBe('light');
    });
  }
});
