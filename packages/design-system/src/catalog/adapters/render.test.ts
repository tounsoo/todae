import { describe, expect, it } from 'vitest';
import { catalog } from '../index';
import type { CatalogEntry, ComponentMeta } from '../types';
import { toRenderCatalog } from './render';

const sample: ComponentMeta = {
  name: 'Sample',
  kind: 'component',
  description: 'A sample control.',
  whenToUse: [],
  whenNotToUse: [],
  intents: [],
  props: [
    { name: 'disabled', type: 'boolean', required: false, description: '' },
    { name: 'label', type: 'string', required: false, description: '' },
    { name: 'max', type: 'number', required: false, description: '' },
    { name: 'variant', type: '"primary" | "secondary" | "ghost"', required: true, description: '' },
    { name: 'children', type: 'React.ReactNode', required: true, description: '' },
    {
      name: 'commitKeys',
      type: 'ReadonlyArray<"Enter" | "Tab" | "," | ";" | " ">',
      required: false,
      description: '',
    },
  ],
  slots: [{ name: 'children', accepts: ['Sample.Icon'], required: false, description: 'Optional icon.' }],
};

describe('toRenderCatalog', () => {
  it('maps boolean, string, number, enum, and opaque types', () => {
    expect(toRenderCatalog([sample])).toEqual({
      components: {
        Sample: {
          description: 'A sample control.',
          props: {
            disabled: { type: 'boolean' },
            label: { type: 'string' },
            max: { type: 'number' },
            variant: { enum: ['primary', 'secondary', 'ghost'] },
            children: { 'x-todae-type': 'React.ReactNode' },
            commitKeys: { 'x-todae-type': 'ReadonlyArray<"Enter" | "Tab" | "," | ";" | " ">' },
          },
          slots: {
            children: { accepts: ['Sample.Icon'], required: false, description: 'Optional icon.' },
          },
        },
      },
    });
  });

  it('skips patterns and maps Button.Root from the real catalog', () => {
    const pattern = catalog.patterns[0];
    expect(pattern).toBeDefined();
    const rendered = toRenderCatalog([pattern as CatalogEntry, catalog.components.find((entry) => entry.name === 'Button.Root')!]);
    expect(rendered).toEqual({
      components: {
        'Button.Root': {
          description: 'Native button. Owns variant, type, and disabled. Default type is button.',
          props: {
            variant: { enum: ['primary', 'secondary', 'ghost'] },
            type: { enum: ['button', 'submit', 'reset'] },
            disabled: { type: 'boolean' },
            'aria-label': { type: 'string' },
            tooltip: { type: 'boolean' },
            children: { 'x-todae-type': 'React.ReactNode' },
          },
          slots: {
            children: {
              accepts: ['Button.Icon'],
              required: false,
              description: 'Label text and optional Button.Icon in DOM order.',
            },
          },
        },
      },
    });
  });
});
