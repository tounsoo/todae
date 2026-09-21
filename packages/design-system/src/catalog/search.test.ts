import { describe, expect, it } from 'vitest';
import { catalog, createSearch, listForIntent, search } from './index';
import type { Catalog, CatalogEntry } from './types';

function entryId(entry: CatalogEntry): string {
  return 'tree' in entry ? entry.id : entry.name;
}

describe('catalog search', () => {
  it('lists choose-one components including Radio, RadioGroup, and OptionList', () => {
    const names = listForIntent('choose-one').map(entryId);
    expect(names).toEqual(expect.arrayContaining(['Radio', 'RadioGroup', 'OptionList']));
  });

  it('ranks Dialog first for modal', () => {
    expect(search('modal')[0]?.entry.name).toBe('Dialog');
  });

  it('ranks BottomSheet above Dialog for sheet', () => {
    const names = search('sheet').map((hit) => entryId(hit.entry));
    expect(names.indexOf('BottomSheet')).toBeGreaterThan(-1);
    expect(names.indexOf('Dialog')).toBeGreaterThan(-1);
    expect(names.indexOf('BottomSheet')).toBeLessThan(names.indexOf('Dialog'));
  });

  it('is deterministic', () => {
    expect(search('field').map((hit) => hit.score)).toEqual(search('field').map((hit) => hit.score));
    expect(search('field').map((hit) => entryId(hit.entry))).toEqual(search('field').map((hit) => entryId(hit.entry)));
  });

  it('filters by kind', () => {
    expect(search('dialog', { kinds: ['hook'] }).every((hit) => !('tree' in hit.entry) && hit.entry.kind === 'hook')).toBe(
      true,
    );
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
    expect(api.listForIntent('choose-one').map(entryId)).toEqual(['Radio']);
    expect(api.search('modal')[0]?.entry.name).toBe('Dialog');
    expect(api.search('radio')[0]?.entry.name).toBe('Radio');
  });
});
