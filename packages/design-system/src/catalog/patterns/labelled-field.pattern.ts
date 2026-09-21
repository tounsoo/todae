import type { PatternMeta } from '../types.ts';

export const pattern = {
  id: 'labelled-field',
  name: 'Labelled field',
  description: 'Label + Field.Root + optional Description and ErrorMessage as siblings.',
  whenToUse: [
    'Caption a text or chip field. Wrap the stack in one .labelled-field.',
    'Put aria-describedby on Field.Root, not on the input.',
  ],
  whenNotToUse: [
    'Do not nest Label inside Field.Root. Label is a sibling.',
    'Do not wrap the label/control stack in Stack. stack.gap is the gap between fields.',
  ],
  intents: ['text-entry', 'tag-entry', 'label', 'helper-text', 'validation-message'],
  uses: ['Label', 'Field.Root', 'Field.TextInput', 'Description', 'ErrorMessage'],
  tree: [
    {
      component: 'Label',
      props: { htmlFor: { $fill: 'fieldId' }, children: { $fill: 'label' } },
    },
    {
      component: 'Field.Root',
      props: { id: { $fill: 'fieldId' }, invalid: { $fill: 'invalid' }, 'aria-describedby': { $fill: 'describedBy' } },
      children: [{ component: 'Field.TextInput', props: { value: { $fill: 'value' } } }],
    },
    {
      component: 'Description',
      props: { id: { $fill: 'hintId' }, children: { $fill: 'hint' } },
    },
    {
      component: 'ErrorMessage',
      props: { id: { $fill: 'errorId' }, children: { $fill: 'error' } },
    },
  ],
  fills: [
    { name: 'fieldId', description: 'Shared id for Label htmlFor and Field.Root.' },
    { name: 'label', description: 'Visible caption. Author a required mark here when needed.' },
    { name: 'invalid', description: 'When true, Field.Root marks the input invalid.' },
    { name: 'describedBy', description: 'Space-separated hint and error ids listed on Field.Root.' },
    { name: 'value', description: 'Controlled input value.' },
    { name: 'hintId', description: 'Description id included in aria-describedby.' },
    { name: 'hint', description: 'Supporting hint copy.' },
    { name: 'errorId', description: 'ErrorMessage id included in aria-describedby when invalid.' },
    { name: 'error', description: 'Validation copy. Render ErrorMessage only when invalid.' },
  ],
  docs: '/field',
} as const satisfies PatternMeta;
