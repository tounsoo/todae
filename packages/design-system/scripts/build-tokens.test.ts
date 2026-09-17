import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PATH_RE,
  buildTokensGraph,
  catalogSelectors,
  flattenTokens,
  serializeValue,
  validateDensitySpaceOnly,
  validateInteractive,
  validateParity,
  validatePaths,
  validateRefs,
  validateVariantTrees,
  type FlatToken,
  type TokenNode,
} from './build-tokens';

const color = (ref: string): TokenNode => ({ $type: 'color', $value: { $ref: ref } });

function tokenMap(tree: Record<string, TokenNode>): Map<string, TokenNode> {
  return new Map(Object.entries(tree));
}

describe('build-tokens validations', () => {
  it('accepts lowercase paths and rejects others', () => {
    expect(PATH_RE.test('color.gray.50')).toBe(true);
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

  it('requires interactive slots and ring.focus only', () => {
    expect(() =>
      validateInteractive(
        flattenTokens({
          button: { bg: { default: color('color.accent.default') } },
        }),
        'contract',
      ),
    ).toThrow(/default\|hover\|active\|focus\|disabled/);
    expect(() =>
      validateInteractive(
        flattenTokens({
          button: { ring: { default: color('color.accent.default'), focus: color('color.accent.default') } },
        }),
        'contract',
      ),
    ).toThrow(/ring\.focus only/);
  });

  it('requires variant trees to match primary', () => {
    const primary = flattenTokens({ button: { radius: { $type: 'dimension', $value: { $ref: 'radius.md' } } } });
    const ghost = flattenTokens({ button: { gap: { $type: 'dimension', $value: { $ref: 'space.inline.gap' } } } });
    expect(() => validateVariantTrees(primary, { ghost })).toThrow(/ghost/);
  });

  it('rejects same-or-higher-layer refs and cycles', () => {
    const tokens: FlatToken[] = [
      {
        path: 'color.bg.canvas',
        type: 'color',
        value: { $ref: 'button.bg.default' },
        ref: 'button.bg.default',
        cssVar: '--todae-color-bg-canvas',
        cssValue: 'var(--todae-button-bg-default)',
        layer: 'appearance',
        context: 'light',
      },
      {
        path: 'button.bg.default',
        type: 'color',
        value: { $ref: 'color.bg.canvas' },
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

  it('emits var chains, not resolved literals', () => {
    const serialized = serializeValue({ $type: 'color', $value: { $ref: 'color.accent.default' } }, 'button.bg.default');
    expect(serialized.cssValue).toBe('var(--todae-color-accent-default)');
    expect(serialized.cssValue).not.toMatch(/oklch\(/);
  });
});

describe('committed token graph', () => {
  it('builds and snapshots CSS selectors', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    expect(graph.css).toContain('@layer todae.base');
    expect(graph.css).toContain(':root,\n[data-appearance="light"]');
    expect(graph.css).toContain('[data-appearance],\n[data-density]');
    expect(graph.css).toContain('[data-button-variant="ghost"]');
    expect(graph.tokens.some((t) => t.layer === 'contract' && t.cssValue.startsWith('var('))).toBe(true);
    expect(catalogSelectors(graph.css)).toMatchSnapshot();
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
    const buttonHover = graph.tokens.find((t) => t.layer === 'contract' && t.path === 'button.bg.hover');
    const buttonActive = graph.tokens.find((t) => t.layer === 'contract' && t.path === 'button.bg.active');
    expect(buttonHover?.cssValue).toBe('var(--todae-color-accent-hover)');
    expect(buttonActive?.cssValue).toBe('var(--todae-color-accent-active)');
  });
});
