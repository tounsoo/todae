import { cleanup, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DensityProvider, useDensity } from './DensityProvider';
import { ThemeProvider, useAppearance } from './ThemeProvider';

function AppearanceLabel() {
  return <span>{useAppearance()}</span>;
}

function DensityLabel() {
  return <span>{useDensity()}</span>;
}

afterEach(cleanup);

function mockMatchMedia(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark') ? dark : !dark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  });
}

describe('ThemeProvider', () => {
  it('resolves system to dark from matchMedia', () => {
    mockMatchMedia(true);
    render(
      <ThemeProvider appearance="system">
        <AppearanceLabel />
      </ThemeProvider>,
    );
    expect(document.querySelector('[data-appearance="dark"]')).not.toBeNull();
    expect(document.querySelector('[data-appearance="system"]')).toBeNull();
    expect(screen.getByText('dark')).toBeTruthy();
  });

  it('nests and keeps the inner appearance', () => {
    mockMatchMedia(false);
    const { container } = render(
      <ThemeProvider appearance="dark">
        <ThemeProvider appearance="light">
          <AppearanceLabel />
        </ThemeProvider>
      </ThemeProvider>,
    );
    const outer = container.querySelector(':scope > [data-appearance="dark"]');
    expect(outer).not.toBeNull();
    expect(outer?.querySelector('[data-appearance="light"]')?.textContent).toBe('light');
    expect(outer?.querySelector('[data-appearance="light"]')?.getAttribute('data-appearance')).toBe(
      'light',
    );
  });

  it('SSR snapshot for system is light', () => {
    const html = renderToString(
      <ThemeProvider appearance="system">
        <AppearanceLabel />
      </ThemeProvider>,
    );
    expect(html).toContain('data-appearance="light"');
    expect(html).not.toContain('data-appearance="system"');
    expect(html).toContain('light');
  });
});

describe('DensityProvider', () => {
  it('writes data-density and exposes the hook', () => {
    render(
      <DensityProvider density="compact">
        <DensityLabel />
      </DensityProvider>,
    );
    expect(document.querySelector('[data-density="compact"]')).not.toBeNull();
    expect(screen.getByText('compact')).toBeTruthy();
  });
});

describe('contract-only components', () => {
  it('forbids hard-coded color and appearance branches', () => {
    const root = join(import.meta.dirname, '../components');
    const files = readdirSync(root).map((name) => join(root, name));
    const banned = /#(?:[0-9a-fA-F]{3}){1,2}\b|oklch\(|data-appearance|prefers-color-scheme/;
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(banned);
    }
  });
});
