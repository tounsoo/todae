// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

afterEach(cleanup);

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
    expect(appearance()).toBe('light');
    expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(appearance()).toBe('dark');
    expect(window.localStorage.getItem('todae-docs-appearance')).toBe('dark');
    cleanup();
    expect(renderSite()()).toBe('dark');
  });

  it('keeps a choice when the pressed item is pressed again', () => {
    const appearance = renderSite();
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(appearance()).toBe('light');
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('ignores a stored value it does not know', () => {
    window.localStorage.setItem('todae-docs-appearance', 'sepia');
    renderSite();
    expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('still switches when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    try {
      const appearance = renderSite();
      expect(appearance()).toBe('light');
      fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
      expect(appearance()).toBe('dark');
      expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true');
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
