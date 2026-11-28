import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';
import { contrastFailures } from './presets.contrast';

type Entry = { fg: string; bg: string; over?: string[] };

type Declares = { $extensions: { 'dev.todae': { contrast: Entry[] } } };

// Every pair the token build checks, the contract's and the appearance's, once per surface listed under a translucent background.
const resolver = JSON.parse(readFileSync(join(import.meta.dirname, '../../../../packages/design-system/tokens/resolver.json'), 'utf8')) as {
  sets: { contract: Declares };
  modifiers: { appearance: Declares };
};
const declared = [...resolver.sets.contract.$extensions['dev.todae'].contrast, ...resolver.modifiers.appearance.$extensions['dev.todae'].contrast];
const measured = declared.reduce((total, entry) => total + (entry.over?.length ?? 1), 0);

describe('preset contrast', () => {
  it('keeps every contract pair of every preset at its minimum in light and dark, as the token build does', () => {
    const { count, lines } = contrastFailures();
    expect(declared.length).toBeGreaterThan(50);
    expect(count).toBe(PRESETS.length * 2 * measured);
    expect(lines, lines.join('\n')).toEqual([]);
  });
});
