import { cleanup, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { ButtonVariant, ButtonVariants } from '../components/Button';
import { DensityProvider, useDensity, type Densities, type Density } from './DensityProvider';
import { ThemeProvider, useAppearance } from './ThemeProvider';
import { THEME_OVERRIDE_KEYS, parseThemeColor, parseThemeValue, themeOverrideStyle, themeOverrideType, themeValueCss } from './themeOverride';

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
  it('leaves system to CSS and resolves it for useAppearance from matchMedia', () => {
    mockMatchMedia(true);
    render(
      <ThemeProvider appearance="system">
        <AppearanceLabel />
      </ThemeProvider>,
    );
    expect(document.querySelector('[data-appearance="system"]')).not.toBeNull();
    expect(document.querySelector('[data-appearance="dark"]')).toBeNull();
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

  it('server-renders system as system, so CSS picks the scheme before hydration', () => {
    const html = renderToString(
      <ThemeProvider appearance="system">
        <AppearanceLabel />
      </ThemeProvider>,
    );
    expect(html).toContain('data-appearance="system"');
    // useAppearance has no media query on the server.
    expect(html).toContain('>light<');
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

describe('extensible densities', () => {
  it('derives Density from the Densities interface companies can augment', () => {
    expectTypeOf<Density>().toEqualTypeOf<keyof Densities>();
    expectTypeOf<ButtonVariant>().toEqualTypeOf<keyof ButtonVariants>();
  });
});

describe('company override types', () => {
  it('accepts extra keys typed by overrideTypes and still rejects others', () => {
    const types = { 'brand.ink': 'color', 'brand.logo.size': 'dimension' } as const;
    expect(
      themeOverrideStyle(
        { 'brand.ink': { colorSpace: 'oklch', components: [0.4, 0.1, 25] }, 'brand.logo.size': { value: 2, unit: 'rem' } },
        types,
      ),
    ).toEqual({ '--todae-brand-ink': 'oklch(0.4 0.1 25)', '--todae-brand-logo-size': '2rem' });
    expect(() => themeOverrideStyle({ 'brand.ink': 3 }, types)).toThrow(/Invalid theme override value for "brand.ink"/);
    expect(() => themeOverrideStyle({ 'brand.other': 3 }, types)).toThrow(/Unknown theme override "brand.other"/);
    expect(() => themeOverrideStyle({ 'brand.ink': { colorSpace: 'oklch', components: [0.4, 0.1, 25] } })).toThrow(
      /Unknown theme override/,
    );
    expect(() => themeOverrideStyle({ 'Brand.Ink': 1 }, { 'Brand.Ink': 'number' })).toThrow(/Unknown theme override/);
    expect(() => themeOverrideStyle({ 'brand.ink': 1 }, { 'brand.ink': 'url' } as never)).toThrow(/Unknown theme override/);
    expect(() => themeOverrideStyle({ toString: 1 }, {})).toThrow(/Unknown theme override/);
    expect(() => themeOverrideStyle({ 'color.bg.canvas': 0.5 }, { 'color.bg.canvas': 'number' } as never)).toThrow(
      /Invalid theme override value for "color.bg.canvas"/,
    );
    expect(
      themeOverrideStyle({ 'radius.md': { value: 1, unit: 'rem' } }, { 'radius.md': 'url' } as never),
    ).toEqual({ '--todae-radius-md': '1rem' });
  });

  it('writes company overrides on the ThemeProvider element', () => {
    render(
      <ThemeProvider
        appearance="light"
        data-testid="theme"
        overrideTypes={{ 'brand.ink': 'color' }}
        overrides={{ 'brand.ink': { colorSpace: 'oklch', components: [0.4, 0.1, 25] }, 'radius.md': { value: 1, unit: 'rem' } }}
      />,
    );
    const el = screen.getByTestId('theme');
    expect(el.style.getPropertyValue('--todae-brand-ink')).toBe('oklch(0.4 0.1 25)');
    expect(el.style.getPropertyValue('--todae-radius-md')).toBe('1rem');
  });

  it("writes each override's private input next to it", () => {
    render(
      <ThemeProvider data-testid="theme" overrides={{ 'card.bg': { colorSpace: 'oklch', components: [0.6, 0.15, 30] } }} />,
    );
    const el = screen.getByTestId('theme');
    expect(el.style.getPropertyValue('--todae-card-bg')).toBe('oklch(0.6 0.15 30)');
    expect(el.style.getPropertyValue('--_todae-card-bg')).toBe('oklch(0.6 0.15 30)');
  });
});

describe('motion, font family, shadow and text transform overrides', () => {
  const types = {
    'brand.motion.fast': 'duration',
    'brand.motion.ease': 'cubicBezier',
    'brand.font.body': 'fontFamily',
    'brand.shadow.card': 'shadow',
    'brand.label.case': 'textTransform',
  } as const;
  const layer = {
    color: { colorSpace: 'oklch', components: [0, 0, 0], alpha: 0.2 },
    offsetX: { value: 0, unit: 'px' },
    offsetY: { value: 4, unit: 'px' },
    blur: { value: 12, unit: 'px' },
    spread: { value: 0, unit: 'px' },
  } as const;

  it('writes typed values as CSS', () => {
    expect(
      themeOverrideStyle(
        {
          'motion.duration.fast': { value: 120, unit: 'ms' },
          'motion.easing.enter': [0.4, 0, 0.2, 1],
          'brand.font.body': ['Inter', 'sans-serif'],
          'brand.shadow.card': [layer, { ...layer, inset: true }],
          'button.base.font.text-transform': 'uppercase',
          'brand.label.case': 'capitalize',
        },
        types,
      ),
    ).toEqual({
      '--todae-motion-duration-fast': '120ms',
      '--todae-motion-easing-enter': 'cubic-bezier(0.4, 0, 0.2, 1)',
      '--todae-brand-font-body': '"Inter", sans-serif',
      '--todae-brand-shadow-card': '0px 4px 12px 0px oklch(0 0 0 / 0.2), inset 0px 4px 12px 0px oklch(0 0 0 / 0.2)',
      '--todae-button-base-font-text-transform': 'uppercase',
      '--todae-brand-label-case': 'capitalize',
    });
  });

  it('rejects values that could escape the declaration or do not fit the type', () => {
    const bad: [string, unknown][] = [
      ['motion.duration.fast', { value: 120, unit: 'px' }],
      ['motion.duration.fast', '120ms'],
      ['motion.easing.enter', [2, 0, 0, 1]],
      ['brand.font.body', 'Inter"; background: url(x)'],
      ['brand.font.body', []],
      ['brand.shadow.card', { ...layer, blur: { value: -1, unit: 'px' } }],
      ['brand.shadow.card', { ...layer, color: 'black' }],
      ['brand.label.case', 'small-caps'],
      ['tabs.font.text-transform', 'uppercase; color: red'],
    ];
    for (const [key, value] of bad) {
      expect(() => themeOverrideStyle({ [key]: value }, types), key).toThrow(/Invalid theme override value/);
    }
  });

  it('lets letter spacing go negative but no other dimension', () => {
    const tight = { value: -0.01, unit: 'rem' } as const;
    expect(themeOverrideStyle({ 'tabs.font.letter-spacing': tight })).toEqual({ '--todae-tabs-font-letter-spacing': '-0.01rem' });
    expect(() => themeOverrideStyle({ 'radius.md': tight })).toThrow(/Invalid theme override value/);
    expect(parseThemeValue('button.base.font.letter-spacing', '-0.01rem')).toEqual(tight);
    expect(parseThemeValue('radius.md', '-0.01rem')).toBeNull();
  });

  it('parses playground text for the new types', () => {
    expect(parseThemeValue('motion.duration.fast', '0.12s')).toEqual({ value: 0.12, unit: 's' });
    expect(parseThemeValue('motion.duration.fast', '12px')).toBeNull();
    expect(parseThemeValue('motion.easing.enter', 'cubic-bezier(0.4, 0, 0.2, 1)')).toEqual([0.4, 0, 0.2, 1]);
    expect(parseThemeValue('motion.easing.enter', '0.4, 0, 0.2')).toBeNull();
    const value = parseThemeValue('motion.duration.fast', '90ms');
    expect(value && themeValueCss('motion.duration.fast', value)).toBe('90ms');
    expect(parseThemeValue('tabs.font.text-transform', ' uppercase ')).toBe('uppercase');
    expect(parseThemeValue('tabs.font.text-transform', 'UPPERCASE')).toBeNull();
  });

  it('writes an empty string for a duration or color it cannot write', () => {
    expect(themeValueCss('motion.duration.fast', { value: -1, unit: 'ms' })).toBe('');
    expect(themeValueCss('color.accent.default', 'red' as never)).toBe('');
  });

  it('reads oklch colors in range and returns null for text it does not read', () => {
    expect(parseThemeColor(' oklch(0.5 0.1 30) ')).toEqual({ colorSpace: 'oklch', components: [0.5, 0.1, 30] });
    expect(parseThemeColor('oklch(1.2 0.1 30)')).toBeNull();
    expect(parseThemeColor('oklch(50% 0.1 30)')).toBeNull();
    expect(parseThemeValue('border.width', '16px')).toBeNull();
    expect(parseThemeColor('oklch(0.5 0.1 30 / 1.5)')).toBeNull();
  });
});

describe('contract-only components', () => {
  it('takes motion and stacking from tokens', () => {
    for (const name of ['Dialog.module.css', 'BottomSheet.module.css', 'Drawer.module.css']) {
      const css = readFileSync(join(import.meta.dirname, '../components', name), 'utf8');
      expect(css, name).not.toMatch(/\d(?:ms|s)\b|cubic-bezier|z-index:\s*\d{2,}/);
    }
    const sheet = readFileSync(join(import.meta.dirname, '../components/BottomSheet.module.css'), 'utf8');
    // A modal <dialog>: the top layer stacks it, so it sets no z-index.
    expect(sheet).not.toContain('z-index');
    expect(sheet).toContain('.sheet::backdrop');
  });

  it('forbids hard-coded color and appearance branches', () => {
    const root = join(import.meta.dirname, '../components');
    // Tests and prop docs may name a color value, such as ColorPicker's #rrggbb.
    const files = readdirSync(root)
      .filter((name) => !/\.test\.tsx?$|\.meta\.ts$/.test(name))
      .map((name) => join(root, name));
    const banned =
      /#(?:[0-9a-fA-F]{3}){1,2}\b|oklch\(|data-appearance|prefers-color-scheme|--todae-color-/;
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(banned);
    }
  });
});
