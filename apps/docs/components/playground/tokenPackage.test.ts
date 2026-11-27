import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';
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
});
