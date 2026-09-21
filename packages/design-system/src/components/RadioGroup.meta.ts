import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'RadioGroup',
  kind: 'component',
  description:
    'Exclusive choice. Requires aria-label or aria-labelledby. Owns value, name, disabled, and invalid.',
  whenToUse: [
    'Exclusive choice that stays on the page. Requires aria-label or aria-labelledby.',
    'Caption with Text and aria-labelledby. Do not point Label htmlFor at the group.',
  ],
  whenNotToUse: [
    'Use OptionList when the options live in a popover or sheet.',
    'Wiring Radio and OptionList to the same value is a QA fail.',
  ],
  intents: [
    'choose-one',
  ],
  slots: [
    { name: 'children', accepts: [
      'Radio',
    ], required: true, description: 'Radio children.' },
  ],
  related: [
    { id: 'Radio', relation: 'requires' },
    { id: 'OptionList', relation: 'alternative' },
    { id: 'Checkbox', relation: 'alternative' },
  ],
  docs: '/radio',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Accessible name when no visible caption exists. Exactly one of aria-label or aria-labelledby.',
    },
    {
      name: 'aria-labelledby',
      type: 'string',
      required: false,
      description: 'Id of the visible caption. Exactly one of aria-label or aria-labelledby.',
    },
    {
      name: 'value',
      type: 'string | null',
      required: false,
      description: 'Controlled value. null is controlled with nothing selected. Omit for uncontrolled.',
    },
    {
      name: 'defaultValue',
      type: 'string | null',
      required: false,
      description: 'Initial value when uncontrolled.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      required: false,
      description: 'Fires with the next selected value.',
    },
    {
      name: 'name',
      type: 'string',
      required: false,
      description: 'Shared native name. Generated when omitted.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'Disables every radio.',
    },
    {
      name: 'invalid',
      type: 'boolean',
      required: false,
      description: 'Marks every radio invalid.',
    },
    {
      name: 'orientation',
      type: '"vertical" | "horizontal"',
      required: false,
      default: '"vertical"',
      description: 'Layout and aria-orientation.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Radio children.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the radiogroup.',
    },
  ],
} as const satisfies ComponentMeta;
