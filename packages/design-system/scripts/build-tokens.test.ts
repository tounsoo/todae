import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PATH_RE,
  buildTokensGraph,
  catalogSelectors,
  flattenTokens,
  pathToPointer,
  pointerToPath,
  serializeValue,
  validateDensitySpaceOnly,
  validateInteractive,
  validateParity,
  validatePaths,
  validateRefs,
  validateFieldChipSlots,
  validatePaintPacks,
  type FlatToken,
  type TokenNode,
} from './build-tokens';

const color = (ref: string): TokenNode => ({ $type: 'color', $value: { $ref: pathToPointer(ref) } });

function tokenMap(tree: Record<string, TokenNode>): Map<string, TokenNode> {
  return new Map(Object.entries(tree));
}

describe('build-tokens validations', () => {
  it('accepts lowercase paths and rejects others', () => {
    expect(PATH_RE.test('color.gray.50')).toBe(true);
    expect(PATH_RE.test('color.on-accent')).toBe(true);
    expect(PATH_RE.test('color.fg.onAccent')).toBe(false);
    expect(() => validatePaths(['Color.Gray.50'], 'core')).toThrow(/lowercase/);
    expect(() => validatePaths(['hue.primary'], 'core')).toThrow(/hue/);
  });

  it('requires light/dark parity', () => {
    const light = tokenMap({ 'color.bg.canvas': color('color.gray.50') });
    const dark = tokenMap({ 'color.bg.canvas': color('color.gray.900'), 'color.fg.default': color('color.gray.50') });
    expect(() => validateParity(light, dark)).toThrow(/light\/dark/);
  });

  it('requires density tokens under space.*', () => {
    expect(() => validateDensitySpaceOnly(tokenMap({ 'color.bg.canvas': color('color.gray.50') }), 'density')).toThrow(
      /space\.\*/,
    );
  });

  it('requires chip and field slot packs', () => {
    expect(() =>
      validateFieldChipSlots(
        flattenTokens({
          chip: { bg: { default: color('color.bg.subtle') } },
        }),
        'contract',
      ),
    ).toThrow(/default\|hover\|focus\|disabled/);
    expect(() =>
      validateFieldChipSlots(
        flattenTokens({
          field: { border: { default: color('color.border.default'), invalid: color('color.danger.default') } },
        }),
        'contract',
      ),
    ).toThrow(/default\|hover\|focus\|disabled\|invalid/);
  });

  it('requires interactive slots and ring.focus only', () => {
    expect(() =>
      validateInteractive(
        flattenTokens({
          button: { primary: { bg: { default: color('color.accent.default') } } },
        }),
        'contract',
      ),
    ).toThrow(/default\|hover\|active\|focus\|disabled/);
    expect(() =>
      validateInteractive(
        flattenTokens({
          button: {
            primary: { ring: { default: color('color.accent.default'), focus: color('color.accent.default') } },
          },
        }),
        'contract',
      ),
    ).toThrow(/ring\.focus only/);
    expect(() =>
      validateInteractive(
        flattenTokens({
          button: { bg: { default: color('color.accent.default') } },
        }),
        'contract',
      ),
    ).toThrow(/button\.primary\|secondary\|ghost/);
  });

  it('requires paint packs to match primary keys', () => {
    const primary = flattenTokens({
      button: { primary: { bg: { default: color('color.accent.default') } } },
    });
    const secondary = flattenTokens({
      button: { secondary: { bg: { default: color('color.bg.surface') } } },
    });
    const ghost = flattenTokens({
      button: { ghost: { fg: { default: color('color.fg.default') } } },
    });
    expect(() => validatePaintPacks({ primary, secondary, ghost })).toThrow(/ghost/);
  });

  it('rejects same-or-higher-layer refs and cycles', () => {
    const tokens: FlatToken[] = [
      {
        path: 'color.bg.canvas',
        type: 'color',
        value: { $ref: '#/button/bg/default/$value' },
        ref: 'button.bg.default',
        cssVar: '--todae-color-bg-canvas',
        cssValue: 'var(--todae-button-bg-default)',
        layer: 'appearance',
        context: 'light',
      },
      {
        path: 'button.bg.default',
        type: 'color',
        value: { $ref: '#/color/bg/canvas/$value' },
        ref: 'color.bg.canvas',
        cssVar: '--todae-button-bg-default',
        cssValue: 'var(--todae-color-bg-canvas)',
        layer: 'contract',
      },
    ];
    const known = new Map<FlatToken['path'], FlatToken['layer']>([
      ['color.bg.canvas', 'appearance'],
      ['button.bg.default', 'contract'],
    ]);
    expect(() => validateRefs(tokens, known)).toThrow(/lower layer/);
  });

  it('parses DTCG JSON Pointer aliases to token paths', () => {
    expect(pointerToPath('#/color/gray/50/$value', 'test')).toBe('color.gray.50');
    expect(pointerToPath('#/color/on-accent/$value', 'test')).toBe('color.on-accent');
    expect(pathToPointer('color.gray.50')).toBe('#/color/gray/50/$value');
  });

  it('rejects the old dot form and unsupported pointers', () => {
    expect(() => pointerToPath('color.gray.50', 'test')).toThrow(/JSON Pointer.*write "#\/color\/gray\/50\/\$value"/);
    expect(() => pointerToPath('#/color/gray/50', 'test')).toThrow(/\/\$value/);
    expect(() => pointerToPath('#/color/gray/50/$value/components/0', 'test')).toThrow(/\/\$value/);
    expect(() => pointerToPath('#/color/gray/50/$value/$value', 'test')).toThrow(/whole-value/);
    expect(() => pointerToPath('#/color/gray.50/$value', 'test')).toThrow(/lowercase segments/);
    expect(() => pointerToPath('#/color//50/$value', 'test')).toThrow(/lowercase segments/);
    expect(() => pointerToPath('#/Color/Gray/$value', 'test')).toThrow(/lowercase segments/);
    expect(() => pointerToPath('#/$value', 'test')).toThrow(/lowercase segments/);
    expect(() =>
      serializeValue({ $type: 'color', $value: { $ref: 'color.accent.default' } }, 'button.bg.default'),
    ).toThrow(/Token "button\.bg\.default" \$ref "color\.accent\.default" must be a JSON Pointer/);
  });

  it('emits var chains, not resolved literals', () => {
    const serialized = serializeValue(
      { $type: 'color', $value: { $ref: '#/color/accent/default/$value' } },
      'button.bg.default',
    );
    expect(serialized.ref).toBe('color.accent.default');
    expect(serialized.cssValue).toBe('var(--todae-color-accent-default)');
    expect(serialized.cssValue).not.toMatch(/oklch\(/);
  });
});

describe('committed token graph', () => {
  it('writes every source alias as a JSON Pointer and keeps dot paths in the catalog', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    const aliases = graph.tokens.filter((t) => t.ref !== null);
    expect(aliases.length).toBeGreaterThan(0);
    for (const token of aliases) {
      expect((token.value as { $ref: string }).$ref).toBe(pathToPointer(token.ref!));
      expect(token.ref).toMatch(PATH_RE);
    }
  });

  it('builds and snapshots CSS selectors', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    expect(graph.css).toContain('@layer todae.base');
    expect(graph.css).toContain(':root,\n[data-appearance="light"]');
    expect(graph.css).toContain('[data-appearance],\n[data-density]');
    expect(graph.css).toContain('[data-button-variant="primary"]');
    expect(graph.css).toContain('[data-button-variant="ghost"]');
    expect(graph.tokens.some((t) => t.layer === 'contract' && t.cssValue.startsWith('var('))).toBe(true);
    expect(catalogSelectors(graph.css)).toMatchSnapshot();
  });

  it('loads field and chip contracts through danger and chip density chains', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    expect(graph.tokens.find((t) => t.path === 'field.leading')?.cssValue).toBe(
      'var(--todae-font-leading-default)',
    );
    const light = graph.css.slice(
      graph.css.indexOf(':root,\n[data-appearance="light"]'),
      graph.css.indexOf('[data-appearance="dark"]'),
    );
    const dark = graph.css.slice(
      graph.css.indexOf('[data-appearance="dark"]'),
      graph.css.indexOf('[data-density="compact"]'),
    );
    expect(light).toContain('color-scheme: light;');
    expect(light).not.toContain('color-scheme: dark');
    expect(dark).toContain('color-scheme: dark;');
    expect(dark).not.toContain('color-scheme: light');
    const invalid = graph.tokens.find((t) => t.path === 'field.border.invalid');
    const pad = graph.tokens.find((t) => t.path === 'chip.padding.x');
    expect(invalid?.cssValue).toBe('var(--todae-color-danger-default)');
    expect(pad?.cssValue).toBe('var(--todae-space-chip-x)');
    for (const context of ['light', 'dark'] as const) {
      expect(
        graph.tokens.some((t) => t.layer === 'appearance' && t.context === context && t.path === 'color.danger.default'),
      ).toBe(true);
    }
    expect(graph.tokens.some((t) => t.path === 'field.radius')).toBe(true);
    expect(graph.tokens.some((t) => t.path === 'field.label.fg')).toBe(true);
    expect(graph.tokens.find((t) => t.path === 'field.label.fg')?.cssValue).toBe('var(--todae-color-fg-default)');
    const labelGap = graph.tokens.find((t) => t.path === 'field.label.gap');
    expect(labelGap?.cssValue).toBe('0.4rem');
    expect(labelGap?.ref).toBeNull();
    expect(labelGap?.layer).toBe('contract');
    const messagesGap = graph.tokens.find((t) => t.path === 'field.messages.gap');
    expect(messagesGap?.cssValue).toBe('0.2rem');
    expect(messagesGap?.ref).toBeNull();
    expect(messagesGap?.layer).toBe('contract');
    expect(graph.tokens.some((t) => t.path === 'chip.bg.default')).toBe(true);
    expect(graph.tokens.find((t) => t.path === 'field.description.fg')?.cssValue).toBe(
      'var(--todae-color-fg-muted)',
    );
    expect(graph.tokens.find((t) => t.path === 'field.error.fg')?.cssValue).toBe(
      'var(--todae-color-danger-default)',
    );
    expect(graph.tokens.find((t) => t.path === 'selection.size')?.cssValue).toBe(
      'var(--todae-space-selection-size)',
    );
    expect(graph.tokens.find((t) => t.path === 'selection.indicator.fg')?.cssValue).toBe(
      'var(--todae-color-on-accent)',
    );
    expect(graph.tokens.find((t) => t.path === 'tooltip.bg')?.cssValue).toBe(
      'var(--todae-color-bg-elevated)',
    );
    expect(graph.tokens.find((t) => t.path === 'tooltip.max-width')?.cssValue).toBe('16rem');
    expect(graph.tokens.find((t) => t.path === 'tooltip.padding.y')?.cssValue).toBe(
      'var(--todae-space-1)',
    );
  });

  it('emits distinct accent hover and active var chains', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    for (const context of ['light', 'dark'] as const) {
      const accent = Object.fromEntries(
        (['default', 'hover', 'active'] as const).map((slot) => {
          const path = `color.accent.${slot}`;
          const token = graph.tokens.find((t) => t.layer === 'appearance' && t.context === context && t.path === path);
          expect(token, path).toBeDefined();
          return [slot, token!.cssValue];
        }),
      );
      expect(accent.hover).toMatch(/^var\(--todae-color-/);
      expect(accent.active).toMatch(/^var\(--todae-color-/);
      expect(accent.hover).not.toBe(accent.default);
      expect(accent.active).not.toBe(accent.default);
      expect(accent.hover).not.toBe(accent.active);
    }
    const buttonHover = graph.tokens.find((t) => t.path === 'button.primary.bg.hover');
    const buttonActive = graph.tokens.find((t) => t.path === 'button.primary.bg.active');
    const buttonFg = graph.tokens.find((t) => t.path === 'button.primary.fg.default');
    expect(buttonHover?.cssValue).toBe('var(--todae-color-accent-hover)');
    expect(buttonActive?.cssValue).toBe('var(--todae-color-accent-active)');
    expect(buttonFg?.cssValue).toBe('var(--todae-color-on-accent)');
    expect(graph.css).toContain('--todae-button-bg-hover: var(--todae-button-primary-bg-hover)');
    expect(graph.css).toContain('--todae-button-bg-active: var(--todae-button-primary-bg-active)');
    expect(graph.css).toContain('--todae-button-radius: var(--todae-button-base-radius)');
  });
});
