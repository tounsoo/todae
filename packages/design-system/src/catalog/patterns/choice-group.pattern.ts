import type { PatternMeta } from '../types.ts';

export const pattern = {
  id: 'choice-group',
  name: 'Choice group',
  description: 'On-page RadioGroup or Checkbox versus overlay OptionList. Never bind both to one value.',
  whenToUse: [
    'Use RadioGroup when one exclusive choice stays on the page.',
    'Use Checkbox when several independent choices stay on the page.',
    'Use OptionList when the choices live in a Popover or BottomSheet.',
  ],
  whenNotToUse: [
    'Do not wire OptionList and Radio or Checkbox to the same value.',
    'Do not put Checkbox or Radio inside Field.Root.',
  ],
  intents: ['choose-one', 'choose-many'],
  uses: ['RadioGroup', 'Radio', 'Checkbox', 'OptionList'],
  tree: [
    {
      component: 'RadioGroup',
      props: { 'aria-labelledby': { $fill: 'captionId' }, value: { $fill: 'value' } },
      children: [{ $fill: 'radios' }],
    },
  ],
  fills: [
    { name: 'captionId', description: 'Id of the visible Text caption. RadioGroup is not labelable via htmlFor.' },
    { name: 'value', description: 'Selected radio value, or null when nothing is selected.' },
    { name: 'radios', description: 'Radio children. Swap this tree for Checkbox siblings or an overlay OptionList.' },
  ],
  docs: '/radio',
} as const satisfies PatternMeta;
