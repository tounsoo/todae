import { describe, expect, it } from 'vitest';
import { optionDomId } from './OptionList.ids';
import { domSafe } from './domId';

describe('domSafe', () => {
  it('keeps letters, digits and hyphens', () => {
    expect(domSafe('Item-2')).toBe('Item-2');
  });

  it('gives values that differ only in escaped characters distinct ids', () => {
    const ids = ['a b', 'a_b', 'a_20_b', 'a.b'].map((value) => optionDomId('list', value));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
