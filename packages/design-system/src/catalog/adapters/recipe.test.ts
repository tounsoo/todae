import { describe, expect, it } from 'vitest';
import { catalog } from '../index';
import type { PatternMeta } from '../types';
import { toCandidateRecipe } from './recipe';

const labelledField = {
  id: 'labelled-field',
  name: 'Labelled field',
  description: 'Label + Field.Root + optional Description and ErrorMessage as siblings.',
  whenToUse: ['Caption a text or chip field.'],
  whenNotToUse: ['Do not nest Label inside Field.Root.'],
  intents: ['text-entry'],
  uses: ['Label', 'Field.Root'],
  tree: [
    {
      component: 'Label',
      props: { htmlFor: { $fill: 'fieldId' }, children: { $fill: 'label' } },
    },
    {
      component: 'Field.Root',
      props: { id: { $fill: 'fieldId' } },
      children: [{ component: 'Field.TextInput', props: { value: { $fill: 'value' } } }],
    },
  ],
  fills: [
    { name: 'fieldId', description: 'Shared id for Label htmlFor and Field.Root.' },
    { name: 'label', description: 'Visible caption.' },
    { name: 'value', description: 'Controlled input value.' },
  ],
} as const satisfies PatternMeta;

describe('toCandidateRecipe', () => {
  it('keeps $fill holes and the fills list without inventing copy or $state', () => {
    const recipe = toCandidateRecipe(labelledField);
    expect(recipe).toEqual({
      id: 'labelled-field',
      description: 'Label + Field.Root + optional Description and ErrorMessage as siblings.',
      hooks: [],
      tree: [
        {
          component: 'Label',
          props: { htmlFor: { $fill: 'fieldId' }, children: { $fill: 'label' } },
        },
        {
          component: 'Field.Root',
          props: { id: { $fill: 'fieldId' } },
          children: [{ component: 'Field.TextInput', props: { value: { $fill: 'value' } } }],
        },
      ],
      fills: [
        { name: 'fieldId', description: 'Shared id for Label htmlFor and Field.Root.' },
        { name: 'label', description: 'Visible caption.' },
        { name: 'value', description: 'Controlled input value.' },
      ],
      constraints: ['Do not nest Label inside Field.Root.'],
    });
    expect(JSON.stringify(recipe)).not.toContain('$state');
  });

  it('copies hooks and does not write $state for every real pattern', () => {
    expect(catalog.patterns.length).toBeGreaterThan(0);
    for (const pattern of catalog.patterns) {
      const recipe = toCandidateRecipe(pattern);
      expect(recipe.id).toBe(pattern.id);
      expect(recipe.fills).toEqual(pattern.fills);
      expect(JSON.stringify(recipe.tree)).toContain('$fill');
      expect(JSON.stringify(recipe)).not.toContain('$state');
    }
    const popover = catalog.patterns.find((pattern) => pattern.id === 'combobox-popover');
    expect(popover).toBeDefined();
    expect(toCandidateRecipe(popover!)).toEqual({
      id: 'combobox-popover',
      description: 'Desktop combobox recipe. Closed control is a Field. List lives in Popover.',
      hooks: [{ id: 'useCombobox', as: 'cb' }],
      tree: popover!.tree,
      fills: popover!.fills,
      constraints: popover!.whenNotToUse,
    });
  });
});
