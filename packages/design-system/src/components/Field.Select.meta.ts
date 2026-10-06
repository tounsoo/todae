import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Select',
  description:
    'Controlled native <select> inside Field.Root. The picker is styled from tokens where appearance: base-select is supported.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Controlled value.',
    },
    {
      name: 'onChange',
      type: '(event: ChangeEvent<HTMLSelectElement>) => void',
      required: true,
      description: 'Native change handler.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      required: false,
      description: 'Optional value callback.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Native <option> and <optgroup> elements.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'Optional class on the select.',
    },
  ],
} as const satisfies ComponentMeta;
