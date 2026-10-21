import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'RadioGroup.Root',
  description:
    'Exclusive choice. Requires aria-label or aria-labelledby. Owns value, name, disabled, and invalid.',
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
      name: 'customValidity',
      type: 'string',
      required: false,
      description:
        "A message for a rule the browser cannot check, set with setCustomValidity on the first radio. An empty string or undefined means the rule holds.",
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
      description: 'RadioGroup.Item children.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the radiogroup.',
    },
  ],
} as const satisfies ComponentMeta;
