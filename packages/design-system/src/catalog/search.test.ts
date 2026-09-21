import { describe, expect, it } from 'vitest';
import { catalog, createSearch, listForIntent, search } from './index.ts';
import type { Catalog } from './types.ts';

describe('catalog search', () => {
  it('lists choose-one components including Radio, RadioGroup, and OptionList', () => {
    const names = listForIntent('choose-one').map((entry) => ('id' in entry && 'tree' in entry ? entry.id : entry.name));
    expect(names).toEqual(expect.arrayContaining(['Radio', 'RadioGroup', 'OptionList']));
  });

  it('ranks Dialog first for modal', () => {
    expect(search('modal')[0]?.entry.name).toBe('Dialog');
  });

  it('ranks BottomSheet above Dialog for sheet', () => {
    const names = search('sheet').map((hit) => ('id' in hit.entry && 'tree' in hit.entry ? hit.entry.id : hit.entry.name));
    expect(names.indexOf('BottomSheet')).toBeGreaterThan(-1);
    expect(names.indexOf('Dialog')).toBeGreaterThan(-1);
    expect(names.indexOf('BottomSheet')).toBeLessThan(names.indexOf('Dialog'));
  });

  it('is deterministic', () => {
    expect(search('field').map((hit) => hit.score)).toEqual(search('field').map((hit) => hit.score));
    expect(search('field').map((hit) => ('name' in hit.entry ? hit.entry.name : hit.entry.id))).toEqual(
      search('field').map((hit) => ('name' in hit.entry ? hit.entry.name : hit.entry.id)),
    );
  });

  it('filters by kind', () => {
    expect(search('dialog', { kinds: ['hook'] })).toEqual([]);
    expect(search('dialog', { kinds: ['component'] })[0]?.entry.name).toBe('Dialog');
  });

  it('populates matched fields', () => {
    const hit = search('modal')[0];
    expect(hit?.matched.length).toBeGreaterThan(0);
  });

  it('createSearch works on a pruned catalog', () => {
    const radio = catalog.components.find((entry) => entry.name === 'Radio');
    const dialog = catalog.components.find((entry) => entry.name === 'Dialog');
    expect(radio).toBeDefined();
    expect(dialog).toBeDefined();
    const pruned = { ...catalog, components: [radio!, dialog!], patterns: [] } satisfies Catalog;
    const api = createSearch(pruned);
    expect(api.getComponent('Radio')?.name).toBe('Radio');
    expect(api.listForIntent('choose-one').map((entry) => ('name' in entry ? entry.name : entry.id))).toEqual(['Radio']);
    expect(api.search('modal')[0]?.entry.name).toBe('Dialog');
    expect(api.search('radio')[0]?.entry.name).toBe('Radio');
  });
});
