import { readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ORIGIN } from '../origin';
import { MAX_MODIFIERS, baseContrast, buildTokenFiles, checkFiles, checkResolver, todaeTokensDir } from './build';
import { GUIDES, GUIDE_TOPICS, getGuide } from './guides';
import { scaffoldDesignSystem } from './scaffold';
import { catalogTokens, getToken, listTokens } from './tokens';

const ACME = join(process.cwd(), '..', '..', 'packages', 'design-system', 'scripts', '__fixtures__', 'acme');

function readTree(root: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out[relative(root, full).split('\\').join('/')] = JSON.parse(readFileSync(full, 'utf8'));
    }
  };
  walk(root);
  return out;
}

describe('token tools', () => {
  it('filters by path prefix and layer, and pages', () => {
    const accent = listTokens({ prefix: 'color.accent' });
    expect(accent.tokens.length).toBeGreaterThan(0);
    expect(accent.tokens.every((row) => row.path.startsWith('color.accent.'))).toBe(true);
    expect(listTokens({ prefix: 'color.accent.default' }).tokens.map((row) => row.context)).toEqual(['light', 'dark']);
    expect(listTokens({ prefix: 'color.acc' }).total).toBe(0);

    const density = listTokens({ layer: 'density' });
    expect(density.tokens.every((row) => row.layer === 'density')).toBe(true);
    const all = listTokens({ limit: 500 });
    expect(all.total).toBe(catalogTokens().length);
    expect(listTokens({ limit: 10, offset: 5 }).tokens).toEqual(catalogTokens().slice(5, 15));
    expect(listTokens({ limit: 10 }).hasMore).toBe(true);
    expect(listTokens({ limit: 500, offset: catalogTokens().length - 1 }).hasMore).toBe(false);
  });

  it('gives a token its value per context and the tokens that read it', () => {
    const accent = getToken('color.accent.default');
    expect(accent).toMatchObject({ type: 'color', layer: 'appearance', cssVar: '--todae-color-accent-default' });
    expect(accent.values.map((row) => row.context)).toEqual(['light', 'dark']);
    // A channel read (accent.soft) and a plain alias both count.
    expect(accent.referencedBy).toEqual(expect.arrayContaining(['color.accent.soft']));
    // A reader of space.10 is not a reader of space.1.
    const readers = getToken('space.1').referencedBy;
    expect(readers.length).toBeGreaterThan(0);
    for (const path of readers) {
      expect(getToken(path).values.some((row) => row.cssValue.includes('var(--todae-space-1)'))).toBe(true);
    }
    expect(() => getToken('color.nope')).toThrow('Unknown token "color.nope"');
  });

  it("measures Todae's contrast pairs in light and dark", async () => {
    const { pairs } = await baseContrast();
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every((pair) => pair.lc >= pair.min)).toBe(true);
    const onAccent = pairs.filter((pair) => pair.fg === 'color.on-accent' && pair.bg === 'color.accent.default');
    expect(onAccent.map((pair) => pair.where)).toEqual(['appearance "light"', 'appearance "dark"']);
  });
});

describe('build_tokens', () => {
  it('builds the acme example and returns its CSS, types and contrast', async () => {
    const result = await buildTokenFiles(readTree(ACME));
    if (!result.ok) throw new Error(result.error);
    expect(result.css).toContain('@layer todae.theme');
    expect(result.css).toContain('--todae-brand-logo-size');
    expect(result.overrideTypes).toContain("'brand.logo.size': 'dimension'");
    expect(result.tokenCount).toBeGreaterThan(0);
    expect(result.contrast.some((pair) => pair.fg === 'color.on-accent' && pair.where === 'appearance "dark"')).toBe(true);
  });

  it('returns the build error, without the temporary folder', async () => {
    const files = readTree(ACME);
    files['appearance/light.json'] = {
      color: { accent: { default: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.97, 0.02, 90] } } } },
      brand: { ink: { $type: 'color', $value: { $ref: '#/color/gray/900/$value' } } },
    };
    const result = await buildTokenFiles(files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('contrast');
    expect(result.error).not.toContain(tmpdir());

    const missing = await buildTokenFiles({ 'resolver.json': files['resolver.json'], 'brand.json': files['brand.json'] });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toMatch(/^Failed to read appearance\/light\.json/);

    // The resolver's own errors name it by a path relative to the working directory.
    const empty = await buildTokenFiles({ 'resolver.json': {} });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toMatch(/^resolver\.json must be/);
  });

  it('refuses paths that leave the folder or are not JSON', () => {
    const resolver = { 'resolver.json': {} };
    for (const bad of ['../x.json', 'a/../../x.json', '/etc/x.json', './x.json', 'x.txt', 'a\\b.json', 'x.json/']) {
      expect(() => checkFiles({ ...resolver, [bad]: {} }), bad).toThrow('Invalid file path');
    }
    expect(() => checkFiles({ 'appearance/light.json': {} })).toThrow('resolver.json');
    expect(() => checkFiles({ ...resolver, 'resolver.json/x.json': {} })).toThrow('both a file and the folder');
    expect(() => checkFiles({ ...resolver, 'big.json': 'x'.repeat(600 * 1024) })).toThrow('at most');
    expect(checkFiles({ ...resolver, 'appearance/light.json': '{}' }).get('appearance/light.json')).toBe('{}');
    // Objects count as compact JSON, as a client sends them.
    expect(checkFiles({ ...resolver, 'a.json': { a: { b: 1 } } }).get('a.json')).toBe('{"a":{"b":1}}');
    expect(() => checkFiles({ 'tokens/resolver.json': {} }, 'tokens/resolver.json')).not.toThrow();
  });

  it('refuses a resolver that asks for an outsized build, before building', async () => {
    const scheme = (i: number) => [
      `s${i}`,
      {
        contexts: { light: [{}], dark: [{}] },
        $extensions: { 'dev.todae': { layer: 'appearance', attribute: `data-s${i}`, colorScheme: true } },
      },
    ];
    const schemes = { modifiers: Object.fromEntries([0, 1, 2, 3, 4].map(scheme)), resolutionOrder: [] };
    expect(() => checkResolver(JSON.stringify(schemes))).toThrow('combinations');
    const result = buildTokenFiles({ 'resolver.json': schemes });
    await expect(result).rejects.toThrow('combinations');

    const many = { modifiers: Object.fromEntries(Array.from({ length: MAX_MODIFIERS + 1 }, (_, i) => [`m${i}`, {}])) };
    expect(() => checkResolver(JSON.stringify(many))).toThrow('modifiers');
    const contexts = { modifiers: { m: { contexts: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`c${i}`, [{}]])) } } };
    expect(() => checkResolver(JSON.stringify(contexts))).toThrow('contexts');
    const refs = { sets: { a: { sources: Array.from({ length: 129 }, () => ({ $ref: './a.json' })) } } };
    expect(() => checkResolver(JSON.stringify(refs))).toThrow('$refs');
    const pairs = { sets: { a: { $extensions: { 'dev.todae': { contrast: Array.from({ length: 65 }, () => ({})) } } } } };
    expect(() => checkResolver(JSON.stringify(pairs))).toThrow('contrast pairs');
    // Todae's acme example is well inside the bounds; invalid JSON is the build's to report.
    expect(() => checkResolver(JSON.stringify(readTree(ACME)['resolver.json']))).not.toThrow();
    expect(() => checkResolver('{nope')).not.toThrow();
  });

  it('builds a resolver that is not at the top level', async () => {
    const files = Object.fromEntries(Object.entries(readTree(ACME)).map(([path, value]) => [`tokens/${path}`, value]));
    expect((await buildTokenFiles(files, { resolver: 'tokens/resolver.json' })).ok).toBe(true);
  });

  it("finds Todae's tokens folder", () => {
    expect(readdirSync(todaeTokensDir())).toContain('resolver.json');
    expect(() => todaeTokensDir(join(tmpdir(), 'no-such-docs-app'))).toThrow('Could not find');
  });
});

describe('scaffold_design_system', () => {
  it('drafts files that build, with declarations for new names', async () => {
    const result = await scaffoldDesignSystem({
      name: 'acme',
      colors: {
        light: { 'color.accent.default': [0.45, 0.16, 25] },
        dark: { 'color.accent.default': [0.78, 0.13, 25] },
      },
      buttonVariants: ['outline', 'soft-tint'],
      densities: ['roomy'],
    });
    expect(result.build).toEqual({ ok: true, tokenCount: expect.any(Number) });
    expect(result.tokensFolder).toBe('tokens');
    expect(Object.keys(result.tokenFiles)).toEqual([
      'resolver.json',
      'appearance/light.json',
      'appearance/dark.json',
      'density/roomy.json',
      'button.outline.json',
      'button.soft-tint.json',
    ]);
    expect(result.otherFiles.map((file) => file.path)).toEqual(['src/todae.d.ts']);
    const dts = result.otherFiles[0]?.contents ?? '';
    expect(dts).toContain('export {};');
    expect(dts).toContain('    outline: true;');
    expect(dts).toContain("    'soft-tint': true;");
    expect(dts).toContain('    roomy: true;');

    // tokenFiles go to build_tokens as they are.
    expect((await buildTokenFiles(result.tokenFiles)).ok).toBe(true);
  });

  it('reports a failing build instead of throwing', async () => {
    const result = await scaffoldDesignSystem({
      name: 'pale',
      colors: {
        light: { 'color.accent.default': [0.97, 0.02, 90] },
        dark: { 'color.accent.default': [0.78, 0.13, 25] },
      },
    });
    expect(result.build.ok).toBe(false);
    if (!result.build.ok) expect(result.build.error).toContain('color.on-accent');
  });

  it('builds an empty starter', async () => {
    const result = await scaffoldDesignSystem({ name: 'blank' });
    expect(result.build.ok).toBe(true);
    expect(Object.keys(result.tokenFiles)).toEqual(['resolver.json']);
    expect(result.otherFiles).toEqual([]);
  });

  it('rejects names Todae has, repeats, and tokens that are not appearance colors', async () => {
    await expect(scaffoldDesignSystem({ name: 'Acme' })).rejects.toThrow('Invalid name');
    await expect(scaffoldDesignSystem({ name: 'a', buttonVariants: ['ghost'] })).rejects.toThrow('already has');
    await expect(scaffoldDesignSystem({ name: 'a', densities: ['compact'] })).rejects.toThrow('already has');
    await expect(scaffoldDesignSystem({ name: 'a', buttonVariants: ['base'] })).rejects.toThrow('reserved');
    await expect(scaffoldDesignSystem({ name: 'a', densities: ['roomy', 'roomy'] })).rejects.toThrow('twice');
    await expect(
      scaffoldDesignSystem({ name: 'a', colors: { light: { 'space.1': [0.5, 0.1, 10] }, dark: { 'space.1': [0.5, 0.1, 10] } } }),
    ).rejects.toThrow('not an appearance color token');
    await expect(
      scaffoldDesignSystem({ name: 'a', colors: { light: { 'color.accent.default': [0.5, 0.1, 10] }, dark: {} } }),
    ).rejects.toThrow('same tokens');
    // Keys that would join to the same string still differ.
    await expect(
      scaffoldDesignSystem({
        name: 'a',
        colors: {
          light: { 'color.accent.default,color.accent.hover': [0.5, 0.1, 10] },
          dark: { 'color.accent.default': [0.5, 0.1, 10], 'color.accent.hover': [0.5, 0.1, 10] },
        },
      }),
    ).rejects.toThrow('same tokens');
  });
});

describe('get_guide', () => {
  it('returns each guide page with absolute links', () => {
    for (const topic of GUIDE_TOPICS) {
      const guide = getGuide(topic);
      expect(guide.docsUrl).toBe(`${DOCS_ORIGIN}/${GUIDES[topic]}`);
      expect(guide.markdown).toMatch(/^# /m);
      expect(guide.markdown).not.toMatch(/\]\(\/[a-z]/);
    }
  });
});
