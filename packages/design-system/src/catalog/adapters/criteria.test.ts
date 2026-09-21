import { describe, expect, it } from 'vitest';
import { catalog } from '../index';
import { toCriteria } from './criteria';

describe('toCriteria', () => {
  it('maps Button.Root prefer, avoid, and requires', () => {
    const entry = catalog.components.find((component) => component.name === 'Button.Root');
    expect(entry).toBeDefined();
    expect(toCriteria(entry!)).toEqual({
      id: 'Button.Root',
      kind: 'component',
      summary: 'Native button. Owns variant, type, and disabled. Default type is button.',
      prefer: [
        'Primary actions. Icon-only roots need aria-label or aria-labelledby. Default type is button.',
      ],
      avoid: [
        'Do not nest Button.Root inside Field.Root as a second role. Fitting labeled buttons do not tip.',
      ],
      intents: ['action'],
      requires: ['Button.Icon'],
    });
  });

  it('maps a pattern id, kind, and uses', () => {
    const entry = catalog.patterns.find((pattern) => pattern.id === 'labelled-field');
    expect(entry).toBeDefined();
    expect(toCriteria(entry!)).toEqual({
      id: 'labelled-field',
      kind: 'pattern',
      summary: 'Label + Field.Root + optional Description and ErrorMessage as siblings.',
      prefer: [
        'Caption a text or chip field. Wrap the stack in one .labelled-field.',
        'Put aria-describedby on Field.Root, not on the input.',
      ],
      avoid: [
        'Do not nest Label inside Field.Root. Label is a sibling.',
        'Do not wrap the label/control stack in Stack. stack.gap is the gap between fields.',
      ],
      intents: ['text-entry', 'tag-entry', 'label', 'helper-text', 'validation-message'],
      requires: ['Label', 'Field.Root', 'Field.TextInput', 'Description', 'ErrorMessage'],
    });
  });

  it('returns criteria for every real catalog entry', () => {
    const entries = [...catalog.components, ...catalog.patterns];
    expect(entries.length).toBeGreaterThan(0);
    const ids = entries.map((entry) => {
      const criteria = toCriteria(entry);
      expect(typeof criteria.id).toBe('string');
      expect(criteria.id.length).toBeGreaterThan(0);
      expect(criteria.summary.length).toBeGreaterThan(0);
      expect(Array.isArray(criteria.prefer)).toBe(true);
      expect(Array.isArray(criteria.avoid)).toBe(true);
      expect(Array.isArray(criteria.intents)).toBe(true);
      expect(Array.isArray(criteria.requires)).toBe(true);
      return criteria.id;
    });
    expect(new Set(ids).size).toBe(ids.length);
  });
});
