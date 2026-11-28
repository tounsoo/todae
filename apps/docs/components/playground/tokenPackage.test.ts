import { describe, expect, it } from 'vitest';
import { buildTokenFiles } from '../../lib/docs-mcp/build';
import { MOTION_CHOICES, isMotionKey, withMotion } from './motion';
import { PRESETS } from './presets';
import { optInMotion } from './replay';
import { BUILD_COMMAND } from '../../lib/token-package/package';
import { playgroundPackage } from './tokenPackage';

describe('playgroundPackage', () => {
  it('puts the token files and a README under tokens/, and names what differs by appearance', () => {
    const acid = PRESETS.find((preset) => preset.id === 'acid');
    if (!acid) throw new Error('no Acid preset');
    const result = playgroundPackage({ name: acid.id, presetName: acid.name, light: acid.light, dark: acid.dark });
    expect(result.fileName).toBe('acid-tokens.zip');
    const paths = Object.keys(result.archive);
    expect(paths[0]).toBe('tokens/resolver.json');
    expect(paths.at(-1)).toBe('tokens/README.md');
    expect(paths.every((path) => path.startsWith('tokens/'))).toBe(true);
    for (const path of Object.keys(result.files)) expect(paths).toContain(`tokens/${path}`);
    const readme = result.archive['tokens/README.md'] ?? '';
    expect(readme).toContain(BUILD_COMMAND);
    expect(readme).toContain('Acid preset');
    expect(result.split.length).toBeGreaterThan(0);
    for (const path of result.split) expect(readme).toContain(`\`${path}\``);
    expect(JSON.parse(result.archive['tokens/resolver.json'] ?? '{}')).toMatchObject({ name: 'acid', version: '2025.10' });
  });

  it('exports plain Todae as a resolver and a README', () => {
    const result = playgroundPackage({ name: 'graphite', presetName: 'Graphite', light: {}, dark: {} });
    expect(Object.keys(result.archive)).toEqual(['tokens/resolver.json', 'tokens/README.md']);
    expect(result.archive['tokens/README.md']).not.toContain('differ by appearance');
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
        // Every motion token the stage applies is declared in the package at its own path, opt-in motions included.
        const declared = new Set<string>();
        const walk = (node: unknown, path: string[]) => {
          if (typeof node !== 'object' || node === null || Array.isArray(node)) return;
          if ('$value' in node) declared.add(path.join('.'));
          else for (const [key, child] of Object.entries(node)) walk(child, [...path, key]);
        };
        for (const [file, text] of Object.entries(result.files)) if (file !== 'resolver.json') walk(JSON.parse(text), []);
        for (const key of Object.keys(light).filter(isMotionKey)) expect(declared.has(key), `${preset.id}/${choice}: ${key}`).toBe(true);
        for (const key of ['popover.motion.offset', 'tabs.motion.panel.duration', 'option.check.motion.duration']) {
          expect(Object.keys(light)).toContain(key);
        }
        const built = await buildTokenFiles(result.files);
        if (!built.ok) expect(built.error, `${preset.id}/${choice}`).toMatch(/^contrast: \d+ pair\(s\) fail APCA/);
      }
    }
  }, 300_000);
});
