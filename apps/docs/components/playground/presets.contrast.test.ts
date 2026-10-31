import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';
import { PRESET_PAIRS, contrastHits, problemLines, ratchet } from './presets.contrast';

const GRANDFATHER = join(import.meta.dirname, 'presets-contrast-grandfather.json');

function parseGrandfather(text: string): string[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('presets-contrast-grandfather.json must be an array of strings');
  }
  return value;
}

function baseGrandfather(file: string): ReadonlySet<string> | 'missing' {
  const detailOf = (error: unknown) => {
    if (typeof error === 'object' && error !== null && 'stderr' in error) return String(error.stderr);
    return error instanceof Error ? error.message : String(error);
  };
  try {
    const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const top = git(['rev-parse', '--show-toplevel']).trim();
    const rel = relative(top, file).split(sep).join('/');
    const base = git(['merge-base', 'HEAD', 'origin/main']).trim();
    return new Set(parseGrandfather(git(['show', `${base}:${rel}`])));
  } catch (error) {
    if (/does not exist|but not in/.test(detailOf(error))) return 'missing';
    throw error;
  }
}

describe('preset contrast', () => {
  it('fails a pair that is not listed and a listed pair that passes', () => {
    const progress = 'acid light progress.fill progress.track';
    const meter = 'acid dark meter.fill.optimum progress.track';
    const found = [progress];
    const list = [meter];
    const result = ratchet(found, list);
    expect(result.unlisted).toEqual(found);
    expect(result.stale).toEqual(list);
    expect(result.added).toEqual([]);
    const grown = ratchet(found, found, new Set());
    expect(grown.added).toEqual(found);
    expect(problemLines([{ key: progress, line: 'acid light line' }], list)).toEqual([
      'acid light line',
      `${meter}: remove it, the list only shrinks`,
    ]);
  });

  it('keeps every preset indicator pair at the contract minimum in light and dark', () => {
    const list = parseGrandfather(readFileSync(GRANDFATHER, 'utf8'));
    expect(list).toEqual([...list].sort());
    const { count, hits } = contrastHits();
    expect(count).toBe(PRESETS.length * 2 * PRESET_PAIRS.length);
    const lines = problemLines(hits, list, baseGrandfather(GRANDFATHER));
    expect(lines, lines.join('\n')).toEqual([]);
  });
});
