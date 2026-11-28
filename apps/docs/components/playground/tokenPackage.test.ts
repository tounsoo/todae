import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTokenFiles } from '../../lib/docs-mcp/build';
import { MOTION_CHOICES, isMotionKey, withMotion } from './motion';
import { PRESETS } from './presets';
import { optInMotion } from './replay';
import { BUILD_COMMAND } from '../../lib/token-package/package';
import { playgroundPackage } from './tokenPackage';

describe('playgroundPackage', () => {
  it('puts the token files and a README under tokens/, beside package.json, and names what differs by appearance', () => {
    const acid = PRESETS.find((preset) => preset.id === 'acid');
    if (!acid) throw new Error('no Acid preset');
    const result = playgroundPackage({ name: acid.id, presetName: acid.name, light: acid.light, dark: acid.dark });
    expect(result.fileName).toBe('acid-tokens.zip');
    const paths = Object.keys(result.archive);
    expect(paths.slice(0, 2)).toEqual(['package.json', 'tokens/resolver.json']);
    expect(paths.at(-1)).toBe('tokens/README.md');
    expect(paths.filter((path) => !path.startsWith('tokens/'))).toEqual(['package.json']);
    for (const path of Object.keys(result.files)) expect(paths).toContain(`tokens/${path}`);
    const readme = result.archive['tokens/README.md'] ?? '';
    expect(readme).toContain(BUILD_COMMAND);
    expect(readme).toContain('Acid preset');
    expect(result.split.length).toBeGreaterThan(0);
    for (const path of result.split) expect(readme).toContain(`\`${path}\``);
    expect(JSON.parse(result.archive['tokens/resolver.json'] ?? '{}')).toMatchObject({ name: 'acid', version: '2025.10' });
  });

  it('exports plain Todae as a resolver, a README and package.json', () => {
    const result = playgroundPackage({ name: 'graphite', presetName: 'Graphite', light: {}, dark: {} });
    expect(Object.keys(result.archive)).toEqual(['package.json', 'tokens/resolver.json', 'tokens/README.md']);
    expect(result.archive['tokens/README.md']).not.toContain('differ by appearance');
  });

  it("writes the package name into package.json, with a build script and Todae's released version", () => {
    const todae = JSON.parse(readFileSync(join(import.meta.dirname, '../../../../packages/design-system/package.json'), 'utf8')) as { version: string };
    const result = playgroundPackage({ name: 'acid', presetName: 'Acid', light: {}, dark: {}, packageName: '@acme/design-tokens' });
    expect(JSON.parse(result.archive['package.json'] ?? '{}')).toEqual({
      name: '@acme/design-tokens',
      version: '0.0.0',
      description: 'Exported from the Todae Playground, starting from the Acid preset.',
      files: ['tokens'],
      scripts: { 'build:tokens': 'todae-tokens build --resolver ./tokens/resolver.json' },
      dependencies: { '@tounsoo/todae': `^${todae.version}` },
    });
    expect(result.fileName).toBe('acme-design-tokens.zip');
    expect(result.archive['tokens/README.md']).toContain('`@acme/design-tokens`');
  });

  it('names the package after the preset when no name is given', () => {
    const result = playgroundPackage({ name: 'riso', presetName: 'Riso', light: {}, dark: {} });
    expect(JSON.parse(result.archive['package.json'] ?? '{}')).toMatchObject({ name: 'riso-tokens' });
    expect(result.fileName).toBe('riso-tokens.zip');
  });

  it('refuses a name npm would refuse', () => {
    expect(() => playgroundPackage({ name: 'acid', presetName: 'Acid', light: {}, dark: {}, packageName: 'Acme Tokens' })).toThrow(
      /"Acme Tokens" is not a valid npm package name \(uppercase\)/,
    );
  });

  it('carries every Motion picker feel and the opt-in motions, and each preset builds with each feel', async () => {
    for (const preset of PRESETS) {
      for (const choice of MOTION_CHOICES) {
        // The Playground exports withOptIn(themeFor(side)): the preset with the picked feel, then the opt-in motions.
        const side = (mode: 'light' | 'dark') => {
          const theme = withMotion(preset[mode], choice);
          return { ...theme, ...optInMotion(theme) };
        };
        const light = side('light');
        const result = playgroundPackage({ name: preset.id, presetName: preset.name, light, dark: side('dark') });
        expect(result.skipped, `${preset.id}/${choice}`).toEqual([]);
        // Every motion token the stage applies is declared in the package at its own path, with the value the stage applies, opt-in motions included.
        const declared = new Map<string, unknown>();
        const walk = (node: unknown, path: string[]) => {
          if (typeof node !== 'object' || node === null || Array.isArray(node)) return;
          if ('$value' in node) declared.set(path.join('.'), node.$value);
          else for (const [key, child] of Object.entries(node)) walk(child, [...path, key]);
        };
        for (const [file, text] of Object.entries(result.files)) if (file !== 'resolver.json') walk(JSON.parse(text), []);
        for (const key of Object.keys(light).filter(isMotionKey)) {
          expect(declared.get(key), `${preset.id}/${choice}: ${key}`).toEqual(light[key as keyof typeof light]);
        }
        for (const key of ['popover.motion.offset', 'tabs.motion.panel.duration', 'option.check.motion.duration']) {
          expect(Object.keys(light)).toContain(key);
        }
        const built = await buildTokenFiles(result.files);
        expect(built.ok ? '' : built.error, `${preset.id}/${choice}`).toBe('');
      }
    }
  }, 300_000);
});
