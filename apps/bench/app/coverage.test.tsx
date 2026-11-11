/**
 * Every public component, hook and Field control of the built package has a
 * bench case, or points at the part whose cases render it, or says why it
 * can't be measured. The typecheck enforces the same list from the source;
 * this checks it against what the package really exports.
 */
import * as todae from '@tounsoo/todae';
import { describe, expect, it } from 'vitest';
import { COVERAGE, GROUPS } from './coverage.ts';
import type { Coverage, Scenario } from './cases/types.tsx';
import { SCENARIOS } from './scenarios.tsx';

const isCases = (coverage: Coverage): coverage is readonly Scenario[] => Array.isArray(coverage);

function publicParts(): string[] {
  const parts: string[] = [];
  for (const name of Object.keys(todae)) {
    if (/^use[A-Z]/.test(name)) parts.push(name);
    // Same rule as the Component type: capitalized, and not a SCREAMING_CASE constant.
    else if (name[0] === name[0]?.toUpperCase() && name !== name.toUpperCase()) parts.push(name);
  }
  parts.push(...Object.keys(todae.Field).map((member) => `Field.${member}`));
  return parts.sort();
}

describe('bench coverage', () => {
  it('has an entry for every public part, and only for those', () => {
    expect(Object.keys(COVERAGE).sort()).toEqual(publicParts());
  });

  it('puts each part in one case file', () => {
    const seen = new Map<string, string>();
    for (const [group, entries] of Object.entries(GROUPS)) {
      for (const part of Object.keys(entries)) {
        expect(seen.get(part), `${part} is in ${seen.get(part)} and ${group}`).toBeUndefined();
        seen.set(part, group);
      }
    }
  });

  it('points every via at a part with cases of its own', () => {
    for (const [part, coverage] of Object.entries<Coverage>(COVERAGE)) {
      if (isCases(coverage) || !('via' in coverage)) continue;
      const target = COVERAGE[coverage.via];
      expect(isCases(target) && target.length > 0, `${part} is measured via ${coverage.via}, which has no cases`).toBe(true);
    }
  });

  it('gives every skip a reason and every listed part a case', () => {
    for (const [part, coverage] of Object.entries<Coverage>(COVERAGE)) {
      if (isCases(coverage)) expect(coverage.length, part).toBeGreaterThan(0);
      else if ('skip' in coverage) expect(coverage.skip.trim(), part).not.toBe('');
    }
  });

  it('keeps case ids unique and hook case ids under use-', () => {
    const ids = SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [part, coverage] of Object.entries<Coverage>(COVERAGE)) {
      if (!isCases(coverage) || !part.startsWith('use')) continue;
      for (const scenario of coverage) expect(scenario.id, part).toMatch(/^use-/);
    }
  });
});
