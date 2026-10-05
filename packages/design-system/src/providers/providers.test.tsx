import { cleanup, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DensityProvider, useDensity } from './DensityProvider';
import { ThemeProvider, useAppearance } from './ThemeProvider';
import { THEME_OVERRIDE_KEYS, themeOverrideStyle, themeOverrideType } from './themeOverride';

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

  it('applies allowlisted typed overrides as CSS vars', () => {
    mockMatchMedia(false);
    const { container } = render(
      <ThemeProvider
        appearance="light"
        overrides={{
          'color.accent.default': { colorSpace: 'oklch', components: [0.4, 0.12, 200] },
        }}
      />,
    );
    const el = container.querySelector('[data-appearance="light"]');
    expect(el).toBeInstanceOf(HTMLElement);
    expect((el as HTMLElement).style.getPropertyValue('--todae-color-accent-default')).toBe(
      'oklch(0.4 0.12 200)',
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

describe('themeOverrideStyle', () => {
  it('rejects unknown keys', () => {
    expect(() =>
      themeOverrideStyle({
        'color.evil': { colorSpace: 'oklch', components: [0.5, 0.1, 200] },
      }),
    ).toThrow(/Unknown theme override/);
  });

  it('rejects raw or malicious CSS values', () => {
    expect(() =>
      themeOverrideStyle({ 'color.accent.default': 'url("javascript:alert(1)")' }),
    ).toThrow(/Invalid theme override value/);
    expect(() => themeOverrideStyle({ 'color.accent.default': 'expression(alert(1))' })).toThrow(
      /Invalid theme override value/,
    );
    expect(() => themeOverrideStyle({ 'color.accent.default': '</style><script>x</script>' })).toThrow(
      /Invalid theme override value/,
    );
  });

  it('applies a known key with a valid typed value', () => {
    expect(
      themeOverrideStyle({
        'color.accent.default': { colorSpace: 'oklch', components: [0.55, 0.18, 255] },
        'color.on-accent': { colorSpace: 'oklch', components: [0.98, 0.005, 260] },
        'space.control.x': { value: 0.5, unit: 'rem' },
        'button.base.radius': { value: 0.5, unit: 'rem' },
        'button.primary.bg.hover': { colorSpace: 'oklch', components: [0.68, 0.16, 255] },
        'chip.bg.default': { colorSpace: 'oklch', components: [0.93, 0.007, 260] },
        'field.padding.x': { value: 0.75, unit: 'rem' },
        'field.border.invalid': { colorSpace: 'oklch', components: [0.45, 0.19, 25] },
        'dialog.bg': { colorSpace: 'oklch', components: [0.98, 0.005, 260] },
        'sheet.snap.mid': 0.5,
      }),
    ).toEqual({
      '--todae-color-accent-default': 'oklch(0.55 0.18 255)',
      '--todae-color-on-accent': 'oklch(0.98 0.005 260)',
      '--todae-space-control-x': '0.5rem',
      '--todae-button-base-radius': '0.5rem',
      '--todae-button-primary-bg-hover': 'oklch(0.68 0.16 255)',
      '--todae-chip-bg-default': 'oklch(0.93 0.007 260)',
      '--todae-field-padding-x': '0.75rem',
      '--todae-field-border-invalid': 'oklch(0.45 0.19 25)',
      '--todae-dialog-bg': 'oklch(0.98 0.005 260)',
      '--todae-sheet-snap-mid': '0.5',
    });
  });

  it('rejects unknown chip slots', () => {
    expect(() =>
      themeOverrideStyle({
        'chip.bg.evil': { colorSpace: 'oklch', components: [0.5, 0.1, 200] },
      }),
    ).toThrow(/Unknown theme override/);
  });

  it('rejects collapsed button paint paths', () => {
    expect(() =>
      themeOverrideStyle({
        'button.bg.hover': { colorSpace: 'oklch', components: [0.55, 0.18, 255] },
      }),
    ).toThrow(/Unknown theme override/);
  });

  it('rejects a typed value that does not match the key', () => {
    expect(() =>
      themeOverrideStyle({
        'space.1': { colorSpace: 'oklch', components: [0.5, 0.1, 200] },
      }),
    ).toThrow(/Invalid theme override value/);
  });
});

describe('override keys', () => {
  it('match every token in the generated catalog, with its type', () => {
    const catalog = JSON.parse(readFileSync(join(import.meta.dirname, '../../tokens/tokens.generated.json'), 'utf8')) as {
      tokens: { path: string; type: string }[];
    };
    const types = new Map(catalog.tokens.map((token) => [token.path, token.type]));
    expect([...THEME_OVERRIDE_KEYS].sort()).toEqual([...types.keys()].sort());
    expect(new Set(THEME_OVERRIDE_KEYS).size).toBe(THEME_OVERRIDE_KEYS.length);
    for (const key of THEME_OVERRIDE_KEYS) expect(themeOverrideType(key), key).toBe(types.get(key));
  });

  it('accept tokens the hand-written list used to miss', () => {
    expect(themeOverrideStyle({ 'space.selection.gap': { value: 0.5, unit: 'rem' } })).toEqual({
      '--todae-space-selection-gap': '0.5rem',
    });
    expect(themeOverrideStyle({ 'field.counter.emphasis.weight': 700 })).toEqual({
      '--todae-field-counter-emphasis-weight': '700',
    });
  });
});

describe('contract-only components', () => {
  it('forbids hard-coded color and appearance branches', () => {
    const root = join(import.meta.dirname, '../components');
    const files = readdirSync(root).map((name) => join(root, name));
    const banned =
      /#(?:[0-9a-fA-F]{3}){1,2}\b|oklch\(|data-appearance|prefers-color-scheme|--todae-color-/;
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(banned);
    }
  });
});
