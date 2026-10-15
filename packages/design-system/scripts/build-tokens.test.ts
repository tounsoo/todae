import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PATH_RE,
  apcaContrast,
  contrastResults,
  resolveEntries,
  buildCompanyTokens,
  buildTokensGraph,
  cli,
  todaeTokensRoot,
  catalogSelectors,
  flattenTokens,
  pathToPointer,
  parseComponentPointer,
  parseExtension,
  pointerToPath,
  serializeValue,
  validateDensitySpaceOnly,
  validateInteractive,
  validateParity,
  validatePaths,
  validateRefs,
  validateReservedRoots,
  validateSlots,
  validateAliasParity,
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
    expect(() => validatePaths(['hue.primary'], 'core')).not.toThrow();
    expect(() => validateReservedRoots(['hue.primary'], 'core')).toThrow(/hue/);
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

  it('requires declared slot groups to have exactly their leaves', () => {
    const chip = { 'chip.bg': ['default', 'hover', 'focus', 'disabled'] };
    const field = { 'field.border': ['default', 'hover', 'focus', 'disabled', 'invalid'] };
    const card = { 'card.*.bg': ['default', 'hover'] };
    expect(() =>
      validateSlots(flattenTokens({ chip: { bg: { default: color('color.bg.subtle') } } }), chip, 'contract'),
    ).toThrow(/"chip\.bg" must have exactly default\|hover\|focus\|disabled/);
    expect(() =>
      validateSlots(
        flattenTokens({
          field: { border: { default: color('color.border.default'), invalid: color('color.danger.default') } },
        }),
        field,
        'contract',
      ),
    ).toThrow(/default\|hover\|focus\|disabled\|invalid/);
    const cards = (leaves: string[]) =>
      flattenTokens({ card: { raised: { bg: Object.fromEntries(leaves.map((leaf) => [leaf, color('color.bg.subtle')])) } } });
    expect(() => validateSlots(cards(['default', 'hover']), card, 'contract')).not.toThrow();
    expect(() => validateSlots(cards(['default']), card, 'contract')).toThrow(/"card\.raised\.bg" must have exactly/);
    expect(() => validateSlots(flattenTokens({ chip: { gap: color('color.bg.subtle') } }), chip, 'contract')).toThrow(
      /slot group "chip\.bg" matches no tokens/,
    );
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
        refs: [{ path: 'button.bg.default', type: 'color', role: 'value' }],
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
        refs: [{ path: 'color.bg.canvas', type: 'color', role: 'value' }],
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

  it('parses pointers to OKLCH channels', () => {
    expect(parseComponentPointer('#/color/accent/default/$value/components/0', 't')).toEqual({
      path: 'color.accent.default',
      channel: 'l',
    });
    expect(parseComponentPointer('#/color/gray/950/$value/components/2', 't').channel).toBe('h');
    expect(() => parseComponentPointer('#/color/gray/950/$value/components/3', 't')).toThrow(/components\/0\|1\|2/);
    expect(() => parseComponentPointer('#/color/gray/950/$value/alpha', 't')).toThrow(/components\/0\|1\|2/);
    expect(() => parseComponentPointer('color.gray.950', 't')).toThrow(/components\/0\|1\|2/);
  });

  it('emits relative color syntax for channel refs', () => {
    const ref = (path: string, i: number) => ({ $ref: `#/${path.replaceAll('.', '/')}/$value/components/${i}` });
    const color = (components: unknown[], alpha?: unknown) => ({
      $type: 'color',
      $value: { colorSpace: 'oklch', components, ...(alpha === undefined ? {} : { alpha }) },
    });
    expect(
      serializeValue(color([ref('color.accent.default', 0), ref('color.accent.default', 1), ref('color.accent.default', 2)], 0.12), 'x'),
    ).toEqual({
      ref: 'color.accent.default',
      refs: [{ path: 'color.accent.default', type: 'color', role: 'component' }],
      cssValue: 'oklch(from var(--todae-color-accent-default) l c h / 0.12)',
    });
    expect(serializeValue(color([0.4, ref('color.accent.default', 1), ref('color.accent.default', 2)]), 'x').cssValue).toBe(
      'oklch(from var(--todae-color-accent-default) 0.4 c h / 1)',
    );
    expect(() => serializeValue(color([ref('color.gray.50', 0), ref('color.gray.900', 1), 0]), 'x')).toThrow(
      /must all point at one color/,
    );
    expect(() => serializeValue(color([0.5, 0.1]), 'x')).toThrow(/three components/);
    expect(() => serializeValue(color(['0.5', 0.1, 30]), 'x')).toThrow(/number or a component \$ref/);
  });

  it('takes a color alpha as a number in [0, 1] or a JSON Pointer to a number token', () => {
    const channel = (i: number) => ({ $ref: `#/color/accent/default/$value/components/${i}` });
    const color = (components: unknown[], alpha: unknown) => ({
      $type: 'color',
      $value: { colorSpace: 'oklch', components, alpha },
    });
    const opacity = { $ref: '#/opacity/12/$value' };
    expect(serializeValue(color([channel(0), channel(1), channel(2)], opacity), 'x')).toEqual({
      ref: 'color.accent.default',
      refs: [
        { path: 'color.accent.default', type: 'color', role: 'component' },
        { path: 'opacity.12', type: 'number', role: 'alpha' },
      ],
      cssValue: 'oklch(from var(--todae-color-accent-default) l c h / var(--todae-opacity-12))',
    });
    expect(serializeValue(color([0.5, 0.1, 30], opacity), 'x')).toEqual({
      ref: null,
      refs: [{ path: 'opacity.12', type: 'number', role: 'alpha' }],
      cssValue: 'oklch(0.5 0.1 30 / var(--todae-opacity-12))',
    });
    expect(serializeValue(color([0.5, 0.1, 30], 0), 'x').cssValue).toBe('oklch(0.5 0.1 30 / 0)');
    expect(serializeValue(color([0.5, 0.1, 30], 1), 'x').cssValue).toBe('oklch(0.5 0.1 30)');
    for (const bad of [1.5, -0.1, '0.5', Number.NaN]) {
      expect(() => serializeValue(color([0.5, 0.1, 30], bad), 'x'), String(bad)).toThrow(/alpha must be a number in \[0, 1\]/);
    }
    expect(() => serializeValue(color([0.5, 0.1, 30], { $ref: 'opacity.12' }), 'x')).toThrow(
      /alpha \$ref "opacity\.12" must be a JSON Pointer/,
    );
  });

  it('rejects curly-brace aliases with a JSON Pointer hint', () => {
    expect(() => serializeValue({ $type: 'color', $value: '{color.gray.50}' }, 'x')).toThrow(
      /curly-brace alias; write \{ "\$ref": "#\/color\/gray\/50\/\$value" \}/,
    );
    expect(() => serializeValue({ $type: 'dimension', $value: '{Space.2}' }, 'x')).toThrow(/curly-brace alias/);
  });

  it('serializes motion, font family, shadow and text transform types', () => {
    const v = ($type: string, $value: unknown) => serializeValue({ $type, $value }, 'x').cssValue;
    expect(v('duration', { value: 200, unit: 'ms' })).toBe('200ms');
    expect(v('duration', { value: 0.3, unit: 's' })).toBe('0.3s');
    expect(() => v('duration', { value: 200, unit: 'px' })).toThrow(/duration must be/);
    expect(() => v('duration', { value: -1, unit: 'ms' })).toThrow(/non-negative/);
    expect(v('cubicBezier', [0.2, 0.8, 0.2, 1])).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(v('cubicBezier', [0.3, -0.5, 0.7, 1.5])).toBe('cubic-bezier(0.3, -0.5, 0.7, 1.5)');
    expect(() => v('cubicBezier', [1.2, 0, 0, 1])).toThrow(/x values must be in \[0, 1\]/);
    expect(() => v('cubicBezier', [0, 0, 1])).toThrow(/four numbers/);
    expect(v('fontFamily', 'Inter')).toBe('"Inter"');
    expect(v('fontFamily', ['Inter Variable', 'system-ui', 'sans-serif'])).toBe('"Inter Variable", system-ui, sans-serif');
    expect(() => v('fontFamily', 'Inter"; color: red')).toThrow(/fontFamily names may only use/);
    expect(() => v('fontFamily', [])).toThrow(/at least one family/);
    expect(v('textTransform', 'uppercase')).toBe('uppercase');
    expect(() => v('textTransform', 'small-caps')).toThrow(/textTransform must be one of none, uppercase/);
    expect(() => v('textTransform', 'none; color: red')).toThrow(/textTransform must be one of/);
    const layer = {
      color: { colorSpace: 'oklch', components: [0, 0, 0], alpha: 0.2 },
      offsetX: { value: 0, unit: 'px' },
      offsetY: { value: 4, unit: 'px' },
      blur: { value: 12, unit: 'px' },
      spread: { value: -2, unit: 'px' },
    };
    expect(v('shadow', layer)).toBe('0px 4px 12px -2px oklch(0 0 0 / 0.2)');
    expect(v('shadow', [layer, { ...layer, inset: true }])).toBe(
      '0px 4px 12px -2px oklch(0 0 0 / 0.2), inset 0px 4px 12px -2px oklch(0 0 0 / 0.2)',
    );
    expect(() => v('shadow', { ...layer, color: { $ref: '#/color/gray/950/$value' } })).toThrow(/literal OKLCH/);
    expect(() => v('shadow', { ...layer, color: { ...layer.color, alpha: { $ref: '#/opacity/20/$value' } } })).toThrow(
      /no \$ref in its channels or alpha/,
    );
    expect(() => v('shadow', { ...layer, blur: { $ref: '#/space/2/$value' } })).toThrow(/literal dimension/);
    expect(() => v('shadow', { ...layer, extra: 1 })).toThrow(/unknown key "extra"/);
    expect(() => v('shadow', [])).toThrow(/at least one layer/);
    expect(() => v('shadow', { ...layer, blur: { value: -1, unit: 'px' } })).toThrow(/blur must not be negative/);
    expect(() => v('shadow', { ...layer, offsetY: { value: 4, unit: 'ms' } })).toThrow(/offsetY must be in px or rem/);
    expect(() => serializeValue({ $type: 'number', $value: 1000.5 }, 'z.overlay')).toThrow(/z-index must be an integer/);
    expect(serializeValue({ $type: 'number', $value: 0.5 }, 'sheet.snap.mid').cssValue).toBe('0.5');
    expect(() => v('number', Number.NaN)).toThrow(/must be a number/);
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
      const value = token.value as { $ref?: string; components?: { $ref: string }[] };
      const pointers = value.$ref ? [value.$ref] : (value.components ?? []).map((component) => component.$ref);
      expect(pointers.length, token.path).toBeGreaterThan(0);
      for (const pointer of pointers) expect(pointer.startsWith(pathToPointer(token.ref!)), token.path).toBe(true);
      expect(token.ref).toMatch(PATH_RE);
    }
  });

  it('references only through JSON Pointers in every token source file', async () => {
    const dir = join(import.meta.dirname, '../tokens');
    const files = (await readdir(dir, { recursive: true }))
      .filter((file) => file.endsWith('.json') && !file.includes('generated') && file !== 'resolver.json')
      .sort();
    expect(files).toContain('core.json');
    const refs: string[] = [];
    function walk(node: unknown, at: string): void {
      if (typeof node === 'string') expect(node, at).not.toMatch(/^\{.*\}$/);
      if (Array.isArray(node)) node.forEach((child, i) => walk(child, `${at}[${i}]`));
      if (typeof node !== 'object' || node === null || Array.isArray(node)) return;
      for (const [key, child] of Object.entries(node)) {
        if (key === '$ref') refs.push(child as string);
        walk(child, `${at}.${key}`);
      }
    }
    for (const file of files) walk(JSON.parse(await readFile(join(dir, file), 'utf8')), file);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ref).toMatch(/^#\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/\$value(?:\/components\/[0-2])?$/);
    expect(refs).toContain('#/opacity/12/$value');
  });

  it('builds and snapshots CSS selectors', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    expect(graph.css).toContain('@layer todae.base');
    expect(graph.css).toContain(':root:not([data-appearance]),\n[data-appearance="light"]');
    expect(graph.css).toContain(':root,\n[data-appearance],\n[data-density]');
    // Density has a root default too, so spacing exists with no DensityProvider above.
    expect(graph.css).toContain(':root:not([data-density]),\n[data-density="comfortable"]');
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
      graph.css.indexOf(':root:not([data-appearance]),\n[data-appearance="light"]'),
      graph.css.indexOf('@media not (prefers-color-scheme: dark)'),
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

  it('derives translucent semantic colors from their base color', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    for (const context of ['light', 'dark'] as const) {
      const value = (path: string) =>
        graph.tokens.find((t) => t.layer === 'appearance' && t.context === context && t.path === path)?.cssValue;
      expect(value('color.bg.selected')).toBe('oklch(from var(--todae-color-accent-default) l c h / var(--todae-opacity-20))');
      expect(value('color.accent.soft')).toBe('oklch(from var(--todae-color-accent-default) l c h / var(--todae-opacity-12))');
      expect(value('color.accent.soft-strong')).toBe(
        'oklch(from var(--todae-color-accent-default) l c h / var(--todae-opacity-28))',
      );
      // A theme's opacity scale cannot tint fills meant to be transparent.
      expect(value('color.bg.transparent')).toMatch(/^oklch\(from var\(--todae-color-gray-\d+\) l c h \/ 0\)$/);
      expect(value('color.bg.scrim')).toMatch(/^oklch\(from var\(--todae-color-gray-950\) l c h \/ var\(--todae-opacity-\d+\)\)$/);
    }
    expect(graph.tokens.filter((t) => t.type === 'color' && t.layer === 'appearance' && t.ref === null)).toEqual([]);
    // Every translucent color takes its alpha from the opacity scale; transparent stays a literal 0.
    const translucent = graph.tokens.filter((t) => t.layer !== 'core' && t.type === 'color' && /\/ (?![01]\))/.test(t.cssValue));
    expect(translucent.length).toBeGreaterThan(0);
    for (const token of translucent) expect(token.cssValue, token.path).toMatch(/ \/ var\(--todae-opacity-\d+\)\)$/);
  });

  it('matches the APCA-W3 reference values', () => {
    const hex = (value: string) => [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number];
    expect(apcaContrast(hex('000000'), hex('ffffff'))).toBeCloseTo(106.04, 2);
    expect(apcaContrast(hex('ffffff'), hex('000000'))).toBeCloseTo(-107.88, 2);
    expect(apcaContrast(hex('888888'), hex('ffffff'))).toBeCloseTo(63.06, 2);
    expect(apcaContrast(hex('ffffff'), hex('888888'))).toBeCloseTo(-68.54, 2);
    expect(apcaContrast(hex('777777'), hex('777777'))).toBe(0);
  });

  it('checks every Todae text pair with APCA in both appearances', async () => {
    const results = contrastResults(await resolveEntries(join(import.meta.dirname, '../tokens')));
    expect(new Set(results.map((r) => r.where))).toEqual(new Set(['appearance "light"', 'appearance "dark"']));
    for (const r of results) expect(r.lc, `${r.fg} on ${r.bg} in ${r.where}`).toBeGreaterThanOrEqual(r.min);
    const pairs = results.map((r) => `${r.fg} on ${r.bg}`);
    for (const pair of [
      'color.fg.default on color.bg.surface',
      'color.fg.muted on color.bg.elevated',
      'color.on-accent on color.accent.hover',
      'color.danger.default on color.bg.surface',
    ]) {
      expect(pairs, pair).toContain(pair);
    }
  });

  it('uses a neutral ink accent and a muted color distinct from the default', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    const at = (path: string, context: string) =>
      graph.tokens.find((t) => t.path === path && t.context === context)?.cssValue;
    for (const context of ['light', 'dark']) {
      expect(at('color.fg.muted', context)).not.toBe(at('color.fg.default', context));
      expect(at('color.fg.muted', context)).not.toBe(at('color.fg.placeholder', context));
      for (const slot of ['default', 'hover', 'active']) {
        expect(at(`color.accent.${slot}`, context)).toMatch(/^var\(--todae-color-gray-\d+\)$/);
      }
    }
    // Blue is one of the category hues, and nothing else reads it.
    const readsBlue = graph.tokens.filter((t) => String(t.cssValue).includes('--todae-color-blue-')).map((t) => t.path);
    expect(readsBlue.filter((path) => !path.startsWith('color.category.'))).toEqual([]);
  });

  it('keeps hover, selected and selected-hover option fills apart under a neutral accent', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    for (const context of ['light', 'dark']) {
      const alpha = (path: string) => {
        const token = graph.tokens.find((t) => t.path === path && t.context === context);
        const ref = token?.refs.find((r) => r.role === 'alpha');
        return graph.tokens.find((t) => t.path === ref?.path)?.value as number;
      };
      // option.bg.hover is color.bg.highlight, selected is color.bg.selected, selected-highlighted is accent.soft-strong.
      expect(alpha('color.bg.selected'), context).toBeGreaterThanOrEqual(2 * alpha('color.bg.highlight'));
      expect(alpha('color.accent.soft-strong') - alpha('color.bg.selected'), context).toBeGreaterThanOrEqual(0.08);
    }
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

describe('resolver-driven build', () => {
  const tokensDir = join(import.meta.dirname, '../tokens');
  const temps: string[] = [];

  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  type Resolver = {
    sets: Record<string, Record<string, unknown>>;
    modifiers: Record<string, { default: string; contexts: Record<string, unknown[]>; [key: string]: unknown }>;
    resolutionOrder: unknown[];
  };

  async function fixture(edit: (resolver: Resolver, root: string) => Promise<void> | void): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'todae-tokens-'));
    temps.push(root);
    await cp(tokensDir, root, { recursive: true });
    const resolver = JSON.parse(await readFile(join(root, 'resolver.json'), 'utf8')) as Resolver;
    await edit(resolver, root);
    await writeFile(join(root, 'resolver.json'), JSON.stringify(resolver));
    return root;
  }

  it('takes density and button variant names from the resolver contexts', async () => {
    const root = await fixture(async (resolver, dir) => {
      const roomy = await readFile(join(dir, 'density/spacious.json'), 'utf8');
      await writeFile(join(dir, 'density/roomy.json'), roomy);
      const outline = (await readFile(join(dir, 'components/button.secondary.json'), 'utf8')).replace(
        '"secondary"',
        '"outline"',
      );
      await writeFile(join(dir, 'components/button.outline.json'), outline);
      resolver.modifiers.density!.contexts.roomy = [{ $ref: './density/roomy.json' }];
      resolver.modifiers.buttonVariant!.contexts.outline = [{ $ref: './components/button.outline.json' }];
    });
    const graph = await buildTokensGraph(root);
    expect(catalogSelectors(graph.css)).toContain('[data-density="roomy"]');
    expect(catalogSelectors(graph.css)).toContain('[data-button-variant="outline"]');
    expect(graph.css).toContain('--todae-button-bg-default: var(--todae-button-outline-bg-default)');
    expect(graph.tokens.find((t) => t.path === 'button.outline.bg.default')).toMatchObject({
      layer: 'contract',
      context: 'outline',
    });
  });

  it('merges sources in order, accepting inline token trees', async () => {
    const root = await fixture((resolver) => {
      (resolver.sets.contract!.sources as unknown[]).push({
        tooltip: { 'max-width': { $type: 'dimension', $value: { value: 20, unit: 'rem' } } },
      });
    });
    const graph = await buildTokensGraph(root);
    expect(graph.tokens.filter((t) => t.path === 'tooltip.max-width')).toHaveLength(1);
    expect(graph.tokens.find((t) => t.path === 'tooltip.max-width')?.cssValue).toBe('20rem');
  });

  it('validates slot completeness after merging, so a later source can override part of a group', async () => {
    const root = await fixture((resolver) => {
      (resolver.sets.button!.sources as unknown[]).push({
        button: { base: { radius: { $type: 'dimension', $value: { value: 2, unit: 'px' } } } },
      });
      (resolver.sets.contract!.sources as unknown[]).push({
        field: { border: { hover: { $type: 'color', $value: { $ref: '#/color/accent/default/$value' } } } },
      });
    });
    const graph = await buildTokensGraph(root);
    expect(graph.tokens.find((t) => t.path === 'button.base.radius')?.cssValue).toBe('2px');
    expect(graph.tokens.find((t) => t.path === 'field.border.hover')?.cssValue).toBe('var(--todae-color-accent-default)');
  });

  it('emits consume aliases for sets declared on :root', async () => {
    const root = await fixture((resolver) => {
      const px = (value: number) => ({ $type: 'dimension', $value: { value, unit: 'px' } });
      resolver.sets.button!.sources = [
        {
          button: {
            base: {
              radius: px(4),
              padding: { x: px(12), y: px(6) },
              font: { size: px(14), weight: { $type: 'fontWeight', $value: 500 },
                'letter-spacing': px(0),
                'text-transform': { $type: 'textTransform', $value: 'none' },
              },
              gap: px(8),
              'border-width': px(1),
              'pressed-ring-width': px(1),
              icon: { size: px(16) },
            },
          },
        },
      ];
      resolver.resolutionOrder = [
        { $ref: '#/sets/core' },
        { $ref: '#/sets/button' },
        { $ref: '#/modifiers/appearance' },
        { $ref: '#/modifiers/density' },
        { $ref: '#/sets/focus' },
        { $ref: '#/modifiers/buttonVariant' },
        { $ref: '#/sets/contract' },
      ];
    });
    const graph = await buildTokensGraph(root);
    const rootBlock = graph.css.slice(graph.css.indexOf(':root {'), graph.css.indexOf(':root:not('));
    expect(rootBlock).toContain('--todae-button-radius: var(--todae-button-base-radius);');
  });

  it('rejects an alias to a token from a later resolution entry', async () => {
    const root = await fixture((resolver) => {
      resolver.resolutionOrder = [
        { $ref: '#/sets/core' },
        { $ref: '#/modifiers/appearance' },
        { $ref: '#/sets/button' },
        { $ref: '#/sets/focus' },
        { $ref: '#/sets/contract' },
        { $ref: '#/modifiers/density' },
        { $ref: '#/modifiers/buttonVariant' },
      ];
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(
      /token "button\.base\.[a-z.]+" references "space\.[a-z0-9.-]+" from modifier "density", which must come earlier/,
    );
  });

  it('rejects an alias in a set declared only on :root', async () => {
    const root = await fixture((resolver) => {
      (resolver.sets.core!.sources as unknown[]).push({
        motion: { easing: { exit: { $type: 'cubicBezier', $value: { $ref: '#/motion/easing/enter/$value' } } } },
      });
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(
      'token "motion.easing.exit" is declared only on :root, so it can\'t reference "motion.easing.enter"',
    );
  });

  it('rejects an alias from one scoped modifier to another', async () => {
    const root = await fixture((resolver) => {
      for (const context of Object.keys(resolver.modifiers.density!.contexts)) {
        resolver.modifiers.density!.contexts[context]!.push({
          space: { tint: { $type: 'color', $value: { $ref: '#/color/accent/default/$value' } } },
        });
      }
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(
      /token "space\.tint" in modifier "density" depends on "color\.accent\.default" from modifier "appearance"; scoped modifiers may not alias each other/,
    );
  });

  it('rejects a scoped modifier depending on another through an intermediate set', async () => {
    // Todae's own layer ranks rule this chain out, so build a minimal resolver
    // whose second modifier sits on a higher layer than the set between them.
    const color = (ref: string) => ({ $type: 'color', $value: { $ref: ref } });
    const oklch = { $type: 'color', $value: { colorSpace: 'oklch', components: [0.5, 0.1, 30] } };
    const root = await fixture((resolver) => {
      const ext = (value: Record<string, unknown>) => ({ $extensions: { 'dev.todae': value } });
      resolver.sets = {
        core: { sources: [{ color: { base: oklch } }], ...ext({ layer: 'core' }) },
        tint: { sources: [{ space: { accent: color('#/color/accent/$value') } }], ...ext({ layer: 'density' }) },
      };
      resolver.modifiers = {
        appearance: {
          default: 'light',
          contexts: { light: [{ color: { accent: color('#/color/base/$value') } }] },
          ...ext({ layer: 'appearance', attribute: 'data-appearance' }),
        },
        size: {
          default: 'm',
          contexts: { m: [{ space: { tint: color('#/space/accent/$value') } }] },
          ...ext({ layer: 'contract', attribute: 'data-size' }),
        },
      };
      resolver.resolutionOrder = [
        { $ref: '#/sets/core' },
        { $ref: '#/modifiers/appearance' },
        { $ref: '#/sets/tint' },
        { $ref: '#/modifiers/size' },
      ];
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(
      /token "space\.tint" in modifier "size" depends on "color\.accent" from modifier "appearance"/,
    );
  });

  it('checks a color alpha $ref: it must exist, be a number in [0, 1], and respect layer order', async () => {
    const veil = (alpha: unknown) => ({
      $type: 'color',
      $value: {
        colorSpace: 'oklch',
        components: [0, 1, 2].map((i) => ({ $ref: `#/color/gray/950/$value/components/${i}` })),
        alpha,
      },
    });
    const withVeil = (alpha: unknown, extra: Record<string, unknown> = {}) =>
      fixture((resolver) => {
        (resolver.sets.contract!.sources as unknown[]).push({ field: { veil: veil(alpha), ...extra } });
      });

    const ok = await buildTokensGraph(await withVeil({ $ref: '#/opacity/45/$value' }));
    expect(ok.css).toContain('--todae-field-veil: var(--_todae-field-veil, oklch(from var(--todae-color-gray-950) l c h / var(--todae-opacity-45)));');
    // A number alias chain is followed to its literal.
    const chained = await buildTokensGraph(
      await withVeil({ $ref: '#/field/fade/$value' }, { fade: { $type: 'number', $value: { $ref: '#/opacity/20/$value' } } }),
    );
    expect(chained.tokens.find((t) => t.path === 'field.veil')?.refs.map((r) => r.path)).toEqual(['color.gray.950', 'field.fade']);

    await expect(buildTokensGraph(await withVeil({ $ref: '#/opacity/99/$value' }))).rejects.toThrow(
      /\$ref "opacity\.99" does not exist/,
    );
    await expect(buildTokensGraph(await withVeil({ $ref: '#/space/2/$value' }))).rejects.toThrow(
      /token "field\.veil" alpha must reference a number, not the dimension "space\.2"/,
    );
    await expect(
      buildTokensGraph(await withVeil({ $ref: '#/field/fade/$value' }, { fade: { $type: 'number', $value: 1.5 } })),
    ).rejects.toThrow(/token "field\.veil" alpha "field\.fade" must stay in \[0, 1\], not 1\.5/);

    const upward = await fixture((resolver) => {
      resolver.modifiers.appearance!.contexts.light!.push({ color: { veil: veil({ $ref: '#/field/fade/$value' }) } });
      resolver.modifiers.appearance!.contexts.dark!.push({ color: { veil: veil(0.5) } });
      (resolver.sets.contract!.sources as unknown[]).push({ field: { fade: { $type: 'number', $value: 0.5 } } });
    });
    await expect(buildTokensGraph(upward)).rejects.toThrow(/must point at a lower layer than appearance/);
  });

  it('allows refs within one set or context, but not cycles or type changes', async () => {
    const color = (ref: string) => ({ $type: 'color', $value: { $ref: ref } });
    const within = await fixture((resolver) => {
      (resolver.sets.contract!.sources as unknown[]).push({
        field: { tint: { a: color('#/field/bg/default/$value') } },
      });
    });
    const graph = await buildTokensGraph(within);
    expect(graph.tokens.find((t) => t.path === 'field.tint.a')?.cssValue).toBe('var(--todae-field-bg-default)');

    const cycle = await fixture((resolver) => {
      (resolver.sets.contract!.sources as unknown[]).push({
        field: { tint: { a: color('#/field/tint/b/$value'), b: color('#/field/tint/a/$value') } },
      });
    });
    await expect(buildTokensGraph(cycle)).rejects.toThrow(/\$ref cycle: field\.tint\.a -> field\.tint\.b -> field\.tint\.a/);

    const crossed = await fixture((resolver) => {
      const light = resolver.modifiers.appearance!.contexts.light!;
      const dark = resolver.modifiers.appearance!.contexts.dark!;
      light.push({ color: { pair: { a: color('#/color/pair/b/$value'), b: color('#/color/gray/50/$value') } } });
      dark.push({ color: { pair: { a: color('#/color/gray/900/$value'), b: color('#/color/pair/a/$value') } } });
    });
    const crossedGraph = await buildTokensGraph(crossed);
    expect(crossedGraph.tokens.find((t) => t.path === 'color.pair.b' && t.context === 'dark')?.ref).toBe('color.pair.a');

    const across = await fixture((resolver) => {
      (resolver.sets.button!.sources as unknown[]).push({
        button: { base: { radius: { $type: 'dimension', $value: { $ref: '#/field/radius/$value' } } } },
      });
    });
    await expect(buildTokensGraph(across)).rejects.toThrow(/must point at a lower layer than contract/);

    // The other way round is allowed: the button set comes earlier in resolutionOrder, in the same layer.
    const earlier = await fixture((resolver) => {
      (resolver.sets.contract!.sources as unknown[]).push({
        field: { tint: { a: { $type: 'dimension', $value: { $ref: '#/button/base/radius/$value' } } } },
      });
    });
    expect((await buildTokensGraph(earlier)).tokens.find((t) => t.path === 'field.tint.a')?.cssValue).toBe(
      'var(--todae-button-base-radius)',
    );

    // Earlier is not enough across layers: a later core set may not read a contract token.
    const lowerLater = await fixture((resolver) => {
      resolver.sets.late = {
        sources: [{ late: { radius: { $type: 'dimension', $value: { $ref: '#/button/base/radius/$value' } } } }],
        $extensions: { 'dev.todae': { layer: 'core' } },
      };
      resolver.resolutionOrder.push({ $ref: '#/sets/late' });
    });
    await expect(buildTokensGraph(lowerLater)).rejects.toThrow(/must point at a lower layer than core/);

    const retyped = await fixture((resolver) => {
      (resolver.sets.contract!.sources as unknown[]).push({
        field: { tint: { a: { $type: 'dimension', $value: { $ref: '#/color/gray/50/$value' } } } },
      });
    });
    await expect(buildTokensGraph(retyped)).rejects.toThrow(
      /token "field\.tint\.a" is a dimension but references the color "color\.gray\.50"/,
    );
  });

  it('applies Todae rules only to sets that opt in', async () => {
    const brand = { brand: { ink: { $type: 'color', $value: { $ref: '#/color/gray/900/$value' } } } };
    const generic = await fixture((resolver) => {
      resolver.sets.brand = { sources: [brand], $extensions: { 'dev.todae': { layer: 'contract' } } };
      resolver.resolutionOrder.push({ $ref: '#/sets/brand' });
    });
    const graph = await buildTokensGraph(generic);
    expect(graph.tokens.find((t) => t.path === 'brand.ink')?.cssValue).toBe('var(--todae-color-gray-900)');

    const strict = await fixture((resolver) => {
      resolver.sets.brand = {
        sources: [brand],
        $extensions: { 'dev.todae': { layer: 'contract', rules: ['reserved-roots'] } },
      };
      resolver.resolutionOrder.push({ $ref: '#/sets/brand' });
    });
    await expect(buildTokensGraph(strict)).rejects.toThrow(/token "brand\.ink" uses reserved-root-violating category "brand"/);
  });

  it('checks alias contexts against the default even without the button rule', () => {
    const contexts = new Map([
      ['solid', ['badge.solid.bg', 'badge.solid.fg']],
      ['soft', ['badge.soft.bg']],
    ]);
    expect(() => validateAliasParity(contexts, 'solid', 'modifier "badge"')).toThrow(
      /modifier "badge" context "soft" must declare the same tokens as "solid"/,
    );
    contexts.set('soft', ['badge.soft.bg', 'badge.soft.fg']);
    expect(() => validateAliasParity(contexts, 'solid', 'modifier "badge"')).not.toThrow();
  });

  it('rejects a ghost variant missing a token when the button rule is off', async () => {
    const root = await fixture(async (resolver, dir) => {
      const ext = (resolver.modifiers.buttonVariant!.$extensions as Record<string, Record<string, unknown>>)['dev.todae']!;
      ext.rules = ['reserved-roots'];
      const file = join(dir, 'components/button.ghost.json');
      const ghost = JSON.parse(await readFile(file, 'utf8'));
      delete ghost.button.ghost.bg.hover;
      await writeFile(file, JSON.stringify(ghost));
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(/context "ghost" must declare the same tokens as "primary"/);
  });

  it('lets a company opt its own components into slot rules', async () => {
    const root = await fixture((resolver) => {
      resolver.sets.card = {
        sources: [{ card: { bg: { default: { $type: 'color', $value: { $ref: '#/color/bg/surface/$value' } } } } }],
        $extensions: { 'dev.todae': { layer: 'contract', slots: { 'card.bg': ['default', 'hover'] } } },
      };
      resolver.resolutionOrder.push({ $ref: '#/sets/card' });
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(/"card\.bg" must have exactly default\|hover/);
  });

  it('requires every context of a scoped modifier to declare the same tokens', async () => {
    const root = await fixture((resolver) => {
      resolver.modifiers.density!.contexts.compact = [
        { space: { 1: { $type: 'dimension', $value: { value: 1, unit: 'px' } } } },
      ];
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(/modifier "density" comfortable\/compact key trees differ/);
  });

  it('rejects a token declared by two resolution entries', async () => {
    const root = await fixture((resolver) => {
      (resolver.sets.contract!.sources as unknown[]).push({ $ref: './components/button.base.json' });
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(/token "button\.base\.[a-z.-]+" is declared by both set "button" and set "contract"/);
  });

  it('rejects malformed resolver entries', async () => {
    const cases: [(resolver: Resolver) => void, RegExp][] = [
      [(r) => r.resolutionOrder.push({ type: 'set', name: 'inline', sources: [] }), /resolutionOrder\[7\] must be/],
      [(r) => r.resolutionOrder.push({ $ref: '#/sets/missing' }), /#\/sets\/missing does not exist/],
      [(r) => r.resolutionOrder.push({ $ref: '#/sets/core' }), /lists #\/sets\/core twice/],
      [(r) => void (r.modifiers.density!.default = 'huge'), /default must name one of its contexts/],
      [(r) => void (r.modifiers.density!.default = 'toString'), /default must name one of its contexts/],
      [(r) => void delete r.sets.core!.$extensions, /set "core" must declare \$extensions\["dev.todae"\]/],
      [(r) => void (r.sets.core!.sources = [{ $ref: '../package.json' }]), /escapes tokens/],
      [(r) => void (r.sets.core!.sources = [{ $ref: '#/sets/contract' }]), /relative token file path/],
      [
        (r) => void ((r.modifiers.density!.$extensions as Record<string, Record<string, unknown>>)['dev.todae']!.attribute = 'data-appearance'),
        /modifier "density" reuses attribute data-appearance/,
      ],
      [
        (r) => void (r.modifiers.appearance!.contexts['high-contrast'] = r.modifiers.appearance!.contexts.dark!),
        /contexts must be light or dark, not "high-contrast"/,
      ],
    ];
    for (const [edit, error] of cases) {
      const root = await fixture(edit);
      await expect(buildTokensGraph(root)).rejects.toThrow(error);
    }
  });

  it('validates the dev.todae extension', () => {
    const ext = (value: unknown) => ({ $extensions: { 'dev.todae': value } });
    expect(parseExtension(ext({ layer: 'core' }), 'set', 'set "x"')).toEqual({ layer: 'core' });
    expect(() => parseExtension(ext({ layer: 'brand' }), 'set', 'set "x"')).toThrow(/layer must be one of/);
    expect(() => parseExtension(ext({ layer: 'toString' }), 'set', 'set "x"')).toThrow(/layer must be one of/);
    expect(() => parseExtension(ext({ layer: 'core', attribute: 'data-x' }), 'set', 'set "x"')).toThrow(
      /unknown dev\.todae key "attribute" \(allowed: layer, rules, slots, contrast\)/,
    );
    expect(() => parseExtension(ext({ layer: 'core', rule: ['button'] }), 'set', 'set "x"')).toThrow(/unknown dev\.todae key "rule"/);
    expect(() => parseExtension(ext({ layer: 'core', rules: ['slots'] }), 'set', 'set "x"')).toThrow(
      /rule "slots" must be one of reserved-roots\|density-space\|button/,
    );
    expect(() => parseExtension(ext({ layer: 'core', rules: ['button', 'button'] }), 'set', 'set "x"')).toThrow(
      /must not repeat/,
    );
    expect(() => parseExtension(ext({ layer: 'core', slots: { 'Chip.bg': ['default'] } }), 'set', 'set "x"')).toThrow(
      /slot group "Chip\.bg"/,
    );
    expect(() => parseExtension(ext({ layer: 'core', slots: { 'chip.bg': [] } }), 'set', 'set "x"')).toThrow(
      /distinct lowercase leaf names/,
    );
    expect(
      parseExtension(ext({ layer: 'contract', rules: ['button'], slots: { 'card.*.bg': ['default'] } }), 'set', 'set "x"'),
    ).toEqual({ layer: 'contract', rules: ['button'], slots: { 'card.*.bg': ['default'] } });
    const pair = { fg: 'color.fg.default', bg: 'color.bg.canvas', min: 75 };
    expect(parseExtension(ext({ layer: 'core', contrast: [pair] }), 'set', 'set "x"')).toEqual({ layer: 'core', contrast: [pair] });
    expect(() => parseExtension(ext({ layer: 'core', contrast: [] }), 'set', 'set "x"')).toThrow(/non-empty array/);
    expect(() => parseExtension(ext({ layer: 'core', contrast: [{ ...pair, fg: 'Color.fg' }] }), 'set', 'set "x"')).toThrow(
      /contrast\[0\] fg must be a token path/,
    );
    expect(() => parseExtension(ext({ layer: 'core', contrast: [{ ...pair, min: 0 }] }), 'set', 'set "x"')).toThrow(/min must be/);
    expect(() => parseExtension(ext({ layer: 'core', contrast: [{ ...pair, min: 120 }] }), 'set', 'set "x"')).toThrow(/min must be/);
    expect(() => parseExtension(ext({ layer: 'core', contrast: [{ ...pair, ratio: 4.5 }] }), 'set', 'set "x"')).toThrow(
      /unknown key "ratio"/,
    );
    expect(() => parseExtension(ext({ layer: 'core', contrast: [pair, pair] }), 'set', 'set "x"')).toThrow(
      /repeats color\.fg\.default on color\.bg\.canvas/,
    );
    expect(() => parseExtension(ext({ layer: 'density' }), 'modifier', 'modifier "x"')).toThrow(/data-\* attribute/);
    expect(() =>
      parseExtension(ext({ layer: 'contract', attribute: 'data-x', alias: true, root: true }), 'modifier', 'modifier "x"'),
    ).toThrow(/alias modifier cannot/);
    expect(
      parseExtension(ext({ layer: 'appearance', attribute: 'data-a', root: true, colorScheme: false }), 'modifier', 'm'),
    ).toEqual({ layer: 'appearance', attribute: 'data-a', root: true });
  });
});

describe('company token build', () => {
  const tokensDir = join(import.meta.dirname, '../tokens');
  const acme = join(import.meta.dirname, '__fixtures__/acme');
  const temps: string[] = [];

  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function company(edit: (resolver: Record<string, any>, root: string) => Promise<void> | void): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'todae-acme-'));
    temps.push(root);
    await cp(acme, root, { recursive: true });
    const resolver = JSON.parse(await readFile(join(root, 'resolver.json'), 'utf8'));
    await edit(resolver, root);
    await writeFile(join(root, 'resolver.json'), JSON.stringify(resolver));
    return join(root, 'resolver.json');
  }

  function blockOf(css: string, selector: string): string {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('\n}', start));
  }

  /** The system rule inside `@media <media>`, which holds that context's tokens again. */
  function systemOf(css: string, media: string): string {
    const start = css.indexOf(`@media ${media} {\n  [data-appearance="system"] {`);
    expect(start, media).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('\n  }', start));
  }

  it('gives system each context under its own media query, in any context order', async () => {
    for (const order of [['light', 'dark'], ['dark', 'light']]) {
      const resolver = await company((def) => {
        const { contexts } = def.modifiers.appearance;
        def.modifiers.appearance.contexts = Object.fromEntries(order.map((context) => [context, contexts[context]]));
      });
      const result = await buildCompanyTokens({ resolver, base: tokensDir });
      const light = systemOf(result.css, 'not (prefers-color-scheme: dark)');
      const dark = systemOf(result.css, '(prefers-color-scheme: dark)');
      expect(light).toContain('--todae-color-accent-default: oklch(0.45 0.16 25);');
      expect(light).toContain('color-scheme: light;');
      expect(dark).toContain('--todae-color-accent-default: oklch(0.78 0.13 25);');
      expect(dark).toContain('color-scheme: dark;');
      // No unconditional rule names system, so a light-only override never reaches a dark system.
      expect(catalogSelectors(result.css).filter((selector) => selector.includes('system'))).toEqual([]);
    }
  });

  it('finds Todae tokens from the builder module', () => {
    expect(todaeTokensRoot()).toBe(tokensDir);
  });

  /**
   * Only the re-declared block reads override inputs, and every token in it
   * does; the only other lines are consume aliases of tokens in the block.
   */
  function expectOverrideInputs(css: string, rescopedSelector: string) {
    const rescoped = blockOf(css, rescopedSelector);
    const lines = rescoped.split('\n').filter((line) => /^ {2}--todae-[a-z0-9-]+: /.test(line));
    const wrapped = lines.filter((line) => /^ {2}(--todae-[a-z0-9-]+): var\(--_todae-[a-z0-9-]+, /.test(line));
    const names = new Set(wrapped.map((line) => line.trim().split(':')[0]));
    expect(wrapped.length).toBeGreaterThan(0);
    for (const line of lines) {
      const name = line.trim().split(':')[0]!;
      if (names.has(name)) expect(line).toContain(`${name}: var(--_${name.slice(2)}, `);
      else expect(names.has(line.match(/^ {2}--todae-[a-z0-9-]+: var\((--todae-[a-z0-9-]+)\);$/)?.[1]), line).toBe(true);
    }
    expect(css.replace(rescoped, '')).not.toContain('--_todae-');
  }

  it('lets only re-declared tokens read override inputs', async () => {
    const todae = await readFile(join(import.meta.dirname, '../src/styles/tokens.generated.css'), 'utf8');
    expectOverrideInputs(todae, ':root,\n[data-appearance],\n[data-density]');
    const { css } = await buildCompanyTokens({ resolver: join(acme, 'resolver.json'), base: tokensDir });
    expectOverrideInputs(css, ':root:not([data-appearance]):not([data-density]),\n[data-appearance],\n[data-density]');
    expect(css).toContain('--todae-brand-logo-fg: var(--_todae-brand-logo-fg, ');
    expect(css).not.toContain('--_todae-brand-ink');
  });

  it('checks many aliases and long alias chains in time that grows about linearly', async () => {
    const root = await mkdtemp(join(tmpdir(), 'todae-scale-'));
    try {
      const many = Object.fromEntries(
        Array.from({ length: 2000 }, (_, i) => [`t${i}`, { $type: 'color', $value: { $ref: '#/color/gray/900/$value' } }]),
      );
      const chain: Record<string, unknown> = { n0: { $type: 'number', $value: 1 } };
      for (let i = 1; i < 2000; i++) chain[`n${i}`] = { $type: 'number', $value: { $ref: `#/brand/chain/n${i - 1}/$value` } };
      const contexts = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`c${i}`, [{ $ref: './many.json' }]]));
      await writeFile(join(root, 'many.json'), JSON.stringify({ brand: { many } }));
      await writeFile(join(root, 'chain.json'), JSON.stringify({ brand: { chain } }));
      await writeFile(
        join(root, 'resolver.json'),
        JSON.stringify({
          version: '2025.10',
          sets: { chain: { sources: [{ $ref: './chain.json' }], $extensions: { 'dev.todae': { layer: 'contract' } } } },
          modifiers: {
            mood: { contexts, default: 'c0', $extensions: { 'dev.todae': { layer: 'appearance', attribute: 'data-mood' } } },
          },
          resolutionOrder: [{ $ref: '#/modifiers/mood' }, { $ref: '#/sets/chain' }],
        }),
      );
      const started = performance.now();
      await buildCompanyTokens({ resolver: join(root, 'resolver.json'), base: tokensDir });
      // Each took over 10 seconds when every ref step scanned every token.
      expect(performance.now() - started).toBeLessThan(5000);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('checks an alpha behind a loop across contexts once per target', async () => {
    // d_i reads a_(i+1) in c0 and b_(i+1) in c1, both read d_(i+1), and d_k reads d0 in c2:
    // no context has a cycle, and the graph has k diamonds between d0 and d_k.
    const build = async (k: number, leaf: number) => {
      const root = await mkdtemp(join(tmpdir(), 'todae-alpha-'));
      try {
        const ref = (path: string) => ({ $ref: `#/brand/x/${path}/$value` });
        const num = (value: unknown) => ({ $type: 'number', $value: value });
        const c0: Record<string, unknown> = {};
        const c1: Record<string, unknown> = {};
        const c2: Record<string, unknown> = {};
        for (let i = 0; i < k; i++) {
          c0[`d${i}`] = num(ref(`a${i + 1}`));
          c1[`d${i}`] = num(ref(`b${i + 1}`));
          c2[`d${i}`] = num(0.5);
        }
        for (let i = 1; i <= k; i++) {
          c0[`a${i}`] = num(ref(`d${i}`));
          c1[`b${i}`] = num(ref(`d${i}`));
          c0[`b${i}`] = num(0.5);
          c1[`a${i}`] = num(0.5);
          c2[`a${i}`] = num(0.5);
          c2[`b${i}`] = num(0.5);
        }
        c0[`d${k}`] = num(leaf);
        c1[`d${k}`] = num(0.5);
        c2[`d${k}`] = num(ref('d0'));
        for (const [file, tree] of Object.entries({ c0, c1, c2 })) {
          await writeFile(join(root, `${file}.json`), JSON.stringify({ brand: { x: tree } }));
        }
        const ink = { $type: 'color', $value: { colorSpace: 'oklch', components: [0.5, 0, 0], alpha: ref('d0') } };
        await writeFile(join(root, 'col.json'), JSON.stringify({ brand: { y: { ink } } }));
        await writeFile(
          join(root, 'resolver.json'),
          JSON.stringify({
            version: '2025.10',
            sets: { col: { sources: [{ $ref: './col.json' }], $extensions: { 'dev.todae': { layer: 'appearance' } } } },
            modifiers: {
              m: {
                default: 'c0',
                contexts: { c0: [{ $ref: './c0.json' }], c1: [{ $ref: './c1.json' }], c2: [{ $ref: './c2.json' }] },
                $extensions: { 'dev.todae': { layer: 'appearance', attribute: 'data-m' } },
              },
            },
            resolutionOrder: [{ $ref: '#/modifiers/m' }, { $ref: '#/sets/col' }],
          }),
        );
        return await buildCompanyTokens({ resolver: join(root, 'resolver.json'), base: tokensDir });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    };
    const started = performance.now();
    await build(24, 0.5);
    // Twice the work per diamond would take minutes here.
    expect(performance.now() - started).toBeLessThan(3000);
    await expect(build(24, 2)).rejects.toThrow('alpha "brand.x.d0" must stay in [0, 1], not 2');
  });

  it('checks an alpha at the end of a long alias chain', async () => {
    const build = async (leaf: number) => {
      const root = await mkdtemp(join(tmpdir(), 'todae-alpha-chain-'));
      try {
        const chain: Record<string, unknown> = { n0: { $type: 'number', $value: leaf } };
        for (let i = 1; i < 2000; i++) chain[`n${i}`] = { $type: 'number', $value: { $ref: `#/brand/chain/n${i - 1}/$value` } };
        const ink = { $type: 'color', $value: { colorSpace: 'oklch', components: [0.5, 0, 0], alpha: { $ref: '#/brand/chain/n1999/$value' } } };
        await writeFile(join(root, 'tokens.json'), JSON.stringify({ brand: { chain, ink } }));
        await writeFile(
          join(root, 'resolver.json'),
          JSON.stringify({
            version: '2025.10',
            sets: { tokens: { sources: [{ $ref: './tokens.json' }], $extensions: { 'dev.todae': { layer: 'contract' } } } },
            modifiers: {},
            resolutionOrder: [{ $ref: '#/sets/tokens' }],
          }),
        );
        return await buildCompanyTokens({ resolver: join(root, 'resolver.json'), base: tokensDir });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    };
    // A walk that recursed once per alias overflowed the stack at about 1500 links.
    await expect(build(0.5)).resolves.toBeDefined();
    await expect(build(2)).rejects.toThrow('alpha "brand.chain.n1999" must stay in [0, 1], not 2');
  });

  it('emits only the company layer, after Todae\'s', async () => {
    const result = await buildCompanyTokens({ resolver: join(acme, 'resolver.json'), base: tokensDir });
    expect(result.css.startsWith('@layer todae.reset, todae.base, todae.components, todae.theme;\n\n@layer todae.theme {')).toBe(
      true,
    );
    expect(catalogSelectors(result.css.slice(result.css.indexOf('@layer todae.theme {')))).toEqual([
      '@layer todae.theme',
      ':root:not([data-appearance]), [data-appearance="light"]',
      '@media not (prefers-color-scheme: dark)',
      '[data-appearance="dark"]',
      '@media (prefers-color-scheme: dark)',
      '[data-density="roomy"]',
      ':root:not([data-appearance]):not([data-density]), [data-appearance], [data-density]',
      '[data-button-variant="outline"]',
    ]);
    const light = blockOf(result.css, ':root:not([data-appearance]),\n[data-appearance="light"]');
    expect(light).toContain('--todae-color-accent-default: oklch(0.45 0.16 25);');
    expect(light).toContain('--todae-brand-ink: var(--todae-color-gray-900);');
    expect(light).not.toContain('--todae-color-bg-canvas');
    const rescoped = blockOf(result.css, '[data-appearance],\n[data-density]');
    expect(rescoped).toContain('--todae-button-outline-bg-default: var(--_todae-button-outline-bg-default, var(--todae-color-bg-transparent));');
    expect(rescoped).toContain('--todae-brand-logo-fg: var(--_todae-brand-logo-fg, var(--todae-brand-ink));');
    expect(rescoped).not.toContain('--todae-button-primary-');
    expect(blockOf(result.css, '[data-button-variant="outline"]')).toContain(
      '--todae-button-bg-default: var(--todae-button-outline-bg-default);',
    );
    expect(blockOf(result.css, '[data-density="roomy"]')).toContain('--todae-space-overlay-padding: var(--todae-space-8);');
  });

  it('never re-points Todae aliases from the company layer', async () => {
    const resolver = await company((r) => {
      r.sets.button = {
        sources: [{ button: { base: { radius: { $type: 'dimension', $value: { value: 1, unit: 'rem' } } } } }],
        $extensions: { 'dev.todae': { layer: 'contract' } },
      };
      r.modifiers.buttonVariant.contexts.primary = [
        { button: { primary: { bg: { default: { $type: 'color', $value: { $ref: '#/color/red/500/$value' } } } } } },
      ];
      r.resolutionOrder.splice(2, 0, { $ref: '#/sets/button' });
    });
    const { css } = await buildCompanyTokens({ resolver, base: tokensDir });
    const rescoped = blockOf(css, '[data-appearance],\n[data-density]');
    expect(rescoped).toContain('--todae-button-primary-bg-default: var(--_todae-button-primary-bg-default, var(--todae-color-red-500));');
    expect(rescoped).toContain('--todae-button-base-radius: var(--_todae-button-base-radius, 1rem);');
    expect(rescoped).not.toMatch(/--todae-button-(bg-default|radius): /);
    expect(css.match(/--todae-button-(bg-default|radius): /g)).toHaveLength(1);
    expect(css).not.toContain('[data-button-variant="primary"]');
    expect(blockOf(css, '[data-button-variant="outline"]')).toContain('--todae-button-bg-default: var(--todae-button-outline-bg-default);');
  });

  it('declares aliases for new tokens in Todae entries', async () => {
    const px = (value: number) => ({ $type: 'dimension', $value: { value, unit: 'px' } });
    const resolver = await company((r) => {
      for (const paint of ['primary', 'secondary', 'ghost', 'outline']) {
        r.modifiers.buttonVariant.contexts[paint] = [
          ...(r.modifiers.buttonVariant.contexts[paint] ?? []),
          { button: { [paint]: { lift: px(2) } } },
        ];
      }
    });
    const { css } = await buildCompanyTokens({ resolver, base: tokensDir });
    const rescoped = blockOf(css, '[data-appearance],\n[data-density]');
    expect(rescoped).toContain('--todae-button-lift: var(--todae-button-primary-lift);');
    expect(rescoped).not.toContain('--todae-button-bg-default:');
    expect(blockOf(css, '[data-button-variant="secondary"]')).toBe(
      '[data-button-variant="secondary"] {\n  --todae-button-lift: var(--todae-button-secondary-lift);',
    );
  });

  it('keeps each token one $type, across contexts and over Todae', async () => {
    const mixed = await company((r) => {
      r.modifiers.appearance.contexts.dark = [
        { color: { accent: { default: { $type: 'color', $value: { $ref: '#/color/gray/50/$value' } } } } },
        { brand: { ink: { $type: 'dimension', $value: { value: 1, unit: 'rem' } } } },
      ];
    });
    await expect(buildCompanyTokens({ resolver: mixed, base: tokensDir })).rejects.toThrow(
      /token "brand\.ink" has \$type color and dimension across contexts/,
    );
    const retyped = await company((r) => {
      r.sets.core = {
        sources: [{ radius: { md: { $type: 'number', $value: 3 } } }],
        $extensions: { 'dev.todae': { layer: 'core' } },
      };
      r.resolutionOrder.unshift({ $ref: '#/sets/core' });
    });
    await expect(buildCompanyTokens({ resolver: retyped, base: tokensDir })).rejects.toThrow(
      /set "core" token "radius\.md" overrides a dimension with a number/,
    );
  });

  it('places new entries where the company lists them', async () => {
    const resolver = await company((r) => {
      r.sets.palette = {
        sources: [{ palette: { ember: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.5, 0.17, 30] } } } }],
        $extensions: { 'dev.todae': { layer: 'core' } },
      };
      r.resolutionOrder.unshift({ $ref: '#/sets/palette' });
      r.modifiers.appearance.contexts.light = [
        { color: { accent: { default: { $type: 'color', $value: { $ref: '#/palette/ember/$value' } } } } },
        { brand: { ink: { $type: 'color', $value: { $ref: '#/color/gray/900/$value' } } } },
      ];
    });
    const { css, tokens } = await buildCompanyTokens({ resolver, base: tokensDir });
    expect(blockOf(css, ':root')).toContain('--todae-palette-ember: oklch(0.5 0.17 30);');
    expect(tokens.find((t) => t.path === 'color.accent.default' && t.context === 'light')?.ref).toBe('palette.ember');
  });

  it('declares default aliases for a company-only alias modifier', async () => {
    const resolver = await company((r) => {
      const color = (ref: string) => ({ $type: 'color', $value: { $ref: ref } });
      r.modifiers.badgeTone = {
        default: 'solid',
        contexts: {
          solid: [{ badge: { solid: { bg: color('#/color/accent/default/$value') } } }],
          soft: [{ badge: { soft: { bg: color('#/color/accent/soft/$value') } } }],
        },
        $extensions: { 'dev.todae': { layer: 'contract', attribute: 'data-badge-tone', alias: true } },
      };
      r.resolutionOrder.push({ $ref: '#/modifiers/badgeTone' });
    });
    const { css } = await buildCompanyTokens({ resolver, base: tokensDir });
    expect(blockOf(css, '[data-appearance],\n[data-density]')).toContain('--todae-badge-bg: var(--todae-badge-solid-bg);');
    expect(blockOf(css, '[data-badge-tone="soft"]')).toContain('--todae-badge-bg: var(--todae-badge-soft-bg);');
  });

  it('holds a company to Todae\'s contrast pairs, which it may retune or extend', async () => {
    const darkAccent = (components: number[]) => async (_r: Record<string, any>, root: string) => {
      const file = join(root, 'appearance/dark.json');
      const tree = JSON.parse(await readFile(file, 'utf8'));
      tree.color.accent.default.$value.components = components;
      await writeFile(file, JSON.stringify(tree));
    };
    const dim = await company(darkAccent([0.6, 0.14, 25]));
    await expect(buildCompanyTokens({ resolver: dim, base: tokensDir })).rejects.toThrow(
      /"color\.on-accent" on "color\.accent\.default" in appearance "dark" is Lc \d+\.\d, below 60/,
    );

    const retuned = await company(async (r, root) => {
      await darkAccent([0.6, 0.14, 25])(r, root);
      r.modifiers.appearance.$extensions['dev.todae'].contrast = [
        { fg: 'color.on-accent', bg: 'color.accent.default', min: 20 },
        { fg: 'color.accent.default', bg: 'color.bg.canvas', min: 20 },
      ];
    });
    await expect(buildCompanyTokens({ resolver: retuned, base: tokensDir })).resolves.toBeDefined();

    const own = await company((r) => {
      r.modifiers.appearance.$extensions['dev.todae'].contrast = [{ fg: 'brand.ink', bg: 'color.bg.canvas', min: 105 }];
    });
    const error = await buildCompanyTokens({ resolver: own, base: tokensDir }).catch((e: Error) => e.message);
    expect(error).toMatch(/^contrast: 2 pair\(s\) fail APCA/);
    expect(error).toContain('"brand.ink" on "color.bg.canvas" in appearance "light" is Lc 102.1, below 105');
    expect(error).toContain('"brand.ink" on "color.bg.canvas" in appearance "dark" is Lc 104.4, below 105');
  });

  it('composites a translucent text color and rejects a translucent background', async () => {
    const veil = (alpha: unknown, min: number) =>
      company((r) => {
        const ch = (i: number) => ({ $ref: `#/color/fg/default/$value/components/${i}` });
        r.sets.brand.sources.push({
          brand: { veil: { $type: 'color', $value: { colorSpace: 'oklch', components: [ch(0), ch(1), ch(2)], alpha } } },
        });
        r.sets.brand.$extensions['dev.todae'].contrast = [{ fg: 'brand.veil', bg: 'color.bg.canvas', min }];
      });
    // fg.default at 60% over the canvas is above Lc 40 in both appearances, but below its opaque Lc 100.
    await expect(buildCompanyTokens({ resolver: await veil(0.6, 40), base: tokensDir })).resolves.toBeDefined();
    await expect(buildCompanyTokens({ resolver: await veil(0.6, 90), base: tokensDir })).rejects.toThrow(
      /"brand\.veil" on "color\.bg\.canvas" in appearance "light" is Lc \d+\.\d, below 90/,
    );
    // An alpha $ref is resolved to its number before compositing.
    const faint = { $ref: '#/opacity/45/$value' };
    await expect(buildCompanyTokens({ resolver: await veil(faint, 15), base: tokensDir })).resolves.toBeDefined();
    await expect(buildCompanyTokens({ resolver: await veil(faint, 60), base: tokensDir })).rejects.toThrow(
      /"brand\.veil" on "color\.bg\.canvas" in appearance "light" is Lc \d+\.\d, below 60/,
    );
    // A set's pairs run in every appearance, not just the default one.
    const darkOnly = await company((r) => {
      r.sets.brand.$extensions['dev.todae'].contrast = [{ fg: 'color.red.400', bg: 'color.bg.canvas', min: 50 }];
    });
    const darkError = await buildCompanyTokens({ resolver: darkOnly, base: tokensDir }).catch((e: Error) => e.message);
    expect(darkError).toMatch(/^contrast: 1 pair\(s\) fail APCA/);
    expect(darkError).toMatch(/"color\.red\.400" on "color\.bg\.canvas" in appearance "dark" is Lc 44\.3, below 50/);
    const scrim = await company((r) => {
      r.sets.brand.$extensions['dev.todae'].contrast = [{ fg: 'color.fg.default', bg: 'color.bg.scrim', min: 1 }];
    });
    await expect(buildCompanyTokens({ resolver: scrim, base: tokensDir })).rejects.toThrow(
      /background "color\.bg\.scrim" must be opaque/,
    );
    const missing = await company((r) => {
      r.sets.brand.$extensions['dev.todae'].contrast = [{ fg: 'color.fg.nope', bg: 'color.bg.canvas', min: 1 }];
    });
    await expect(buildCompanyTokens({ resolver: missing, base: tokensDir })).rejects.toThrow(/token "color\.fg\.nope" does not exist/);
  });

  it('merges the catalog and types only the company tokens', async () => {
    const result = await buildCompanyTokens({ resolver: join(acme, 'resolver.json'), base: tokensDir });
    const rows = JSON.parse(result.json).tokens as { path: string; context: string | null; cssValue: string }[];
    expect(rows.some((row) => row.path === 'color.gray.50')).toBe(true);
    expect(rows.some((row) => row.path === 'button.outline.bg.default' && row.context === 'outline')).toBe(true);
    expect(rows.filter((row) => row.path === 'color.accent.default').map((row) => row.cssValue)).toEqual([
      'oklch(0.45 0.16 25)',
      'oklch(0.78 0.13 25)',
    ]);
    expect(rows.filter((row) => row.path === 'space.control.x').map((row) => row.context)).toEqual([
      'compact',
      'comfortable',
      'spacious',
      'roomy',
    ]);
    expect(result.overrideTypes).toContain("  'brand.ink': 'color',");
    expect(result.overrideTypes).toContain("  'brand.logo.size': 'dimension',");
    expect(result.overrideTypes).toContain("  'brand.font.body': 'fontFamily',");
    expect(result.overrideTypes).toContain("  'brand.shadow.card': 'shadow',");
    expect(result.overrideTypes).not.toContain("'color.gray.50'");
    expect(result.css).toContain('--todae-brand-font-body: var(--_todae-brand-font-body, "Acme Sans", system-ui, sans-serif);');
    expect(result.css).toContain('--todae-brand-shadow-card: var(--_todae-brand-shadow-card, 0px 6px 16px -4px oklch(0.2 0.02 25 / 0.18));');
    expect(result.css).toContain('--todae-brand-motion-settle: var(--_todae-brand-motion-settle, var(--todae-motion-duration-slow));');
  });

  it('requires new contexts and additions to keep context parity with Todae', async () => {
    const roomy = await company(async (_resolver, root) => {
      const file = join(root, 'density/roomy.json');
      const tokens = JSON.parse(await readFile(file, 'utf8'));
      delete tokens.space.overlay;
      await writeFile(file, JSON.stringify(tokens));
    });
    await expect(buildCompanyTokens({ resolver: roomy, base: tokensDir })).rejects.toThrow(
      /modifier "density" comfortable\/roomy key trees differ/,
    );
    const brand = await company((resolver) => {
      resolver.modifiers.appearance.contexts.dark = [{ color: {} }];
    });
    await expect(buildCompanyTokens({ resolver: brand, base: tokensDir })).rejects.toThrow(/appearance light\/dark key trees differ/);
    const outline = await company(async (_resolver, root) => {
      const file = join(root, 'button.outline.json');
      const tokens = JSON.parse(await readFile(file, 'utf8'));
      delete tokens.button.outline.ring;
      await writeFile(file, JSON.stringify(tokens));
    });
    await expect(buildCompanyTokens({ resolver: outline, base: tokensDir })).rejects.toThrow(
      /variant "outline" paint keys must match button\.primary/,
    );
  });

  it('rejects extensions that change Todae\'s placement or redeclare its tokens', async () => {
    const cases: [(resolver: Record<string, any>) => void, RegExp][] = [
      [
        (r) => (r.modifiers.density.$extensions['dev.todae'].attribute = 'data-space'),
        /modifier "density" extends Todae's modifier "density", so its attribute must match/,
      ],
      [(r) => (r.modifiers.density.default = 'roomy'), /so its default must stay "comfortable"/],
      [
        (r) => (r.sets.brand.sources = [{ color: { gray: { 50: { $type: 'color', $value: { $ref: '#/brand/ink/$value' } } } } }]),
        /token "color\.gray\.50" is declared by both set "core" and set "brand"/,
      ],
      [
        (r) => {
          r.modifiers.contrast = {
            default: 'more',
            contexts: { more: [{ space: { hairline: { $type: 'dimension', $value: { value: 2, unit: 'px' } } } }] },
            $extensions: { 'dev.todae': { layer: 'density', attribute: 'data-appearance' } },
          };
          r.resolutionOrder.push({ $ref: '#/modifiers/contrast' });
        },
        /modifier "contrast" reuses attribute data-appearance/,
      ],
      [
        (r) => (r.modifiers.buttonVariant.contexts.base = r.modifiers.buttonVariant.contexts.outline),
        /context "base" is reserved/,
      ],
      [
        (r) => {
          delete r.modifiers.density.$extensions['dev.todae'].rules;
          r.modifiers.density.contexts.comfortable = [
            { radius: { huge: { $type: 'dimension', $value: { value: 2, unit: 'rem' } } } },
          ];
        },
        /density token "radius\.huge" must be under space\.\*/,
      ],
      [
        (r) => {
          r.sets.button = {
            sources: [{ button: { base: { lift: { $type: 'dimension', $value: { value: 1, unit: 'px' } } } } }],
            $extensions: { 'dev.todae': { layer: 'contract' } },
          };
          r.resolutionOrder.push({ $ref: '#/sets/button' });
        },
        /button\.base must be radius, padding\.x\/y, font\.size\/weight\/letter-spacing\/text-transform, gap/,
      ],
      [
        (r) => {
          r.sets.contract = {
            sources: [{ chip: { bg: { pressed: { $type: 'color', $value: { $ref: '#/color/bg/subtle/$value' } } } } }],
            $extensions: { 'dev.todae': { layer: 'contract' } },
          };
          r.resolutionOrder.push({ $ref: '#/sets/contract' });
        },
        /"chip\.bg" must have exactly default\|hover\|focus\|disabled/,
      ],
    ];
    for (const [edit, error] of cases) {
      const resolver = await company(edit);
      await expect(buildCompanyTokens({ resolver, base: tokensDir })).rejects.toThrow(error);
    }
  });

  it('can be imported when argv[1] is not a file', () => {
    const out = execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--no-warnings',
        '--input-type=module',
        '-e',
        `await import(${JSON.stringify(join(import.meta.dirname, 'build-tokens.ts'))}); process.stdout.write('ok');`,
        'not-a-file',
      ],
      { encoding: 'utf8' },
    );
    expect(out).toBe('ok');
  });

  it('writes, checks and reports drift from the CLI', async () => {
    const out = await mkdtemp(join(tmpdir(), 'todae-cli-'));
    temps.push(out);
    const args = (...extra: string[]) => [
      'build',
      '--resolver',
      join(acme, 'resolver.json'),
      '--base',
      tokensDir,
      '--css',
      join(out, 'acme.css'),
      '--catalog',
      join(out, 'acme.json'),
      '--types',
      join(out, 'acme.types.ts'),
      ...extra,
    ];
    await expect(cli(args('--check'))).rejects.toThrow(/acme\.css is missing/);
    await cli(args());
    await expect(cli(args('--check'))).resolves.toBeUndefined();
    expect(await readFile(join(out, 'acme.types.ts'), 'utf8')).toContain("'brand.ink': 'color'");
    await writeFile(join(out, 'acme.css'), '');
    await expect(cli(args('--check'))).rejects.toThrow(/acme\.css drifted/);
    await expect(cli(['build'])).rejects.toThrow(/Usage: todae-tokens build/);
    await expect(cli(['buld', '--resolver', join(acme, 'resolver.json')])).rejects.toThrow(/Usage: todae-tokens build/);
    await expect(cli([])).rejects.toThrow(/Usage: todae-tokens build/);
  });
});
