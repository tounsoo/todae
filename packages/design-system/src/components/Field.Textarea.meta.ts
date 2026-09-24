import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.Textarea',
  description: 'Controlled multi-line text inside Field.Root. Height is CSS only.',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'Controlled value.',
    },
    {
      name: 'onChange',
      type: '(event: ChangeEvent<HTMLTextAreaElement>) => void',
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
      name: 'placeholder',
      type: 'string',
      required: false,
      description: 'Native placeholder.',
    },
    {
      name: 'rows',
      type: 'number',
      required: false,
      default: '"3"',
      description: 'Starting height in rows. Also the native rows attribute and the drag floor.',
    },
    {
      name: 'maxRows',
      type: 'number',
      required: false,
      description: 'Caps autoGrow and drag-resize. Omitted means no cap.',
    },
    {
      name: 'autoGrow',
      type: 'boolean',
      required: false,
      default: '"false"',
      description: 'Grows with content up to maxRows using CSS only. No maxRows means no cap.',
    },
  ],
} as const satisfies ComponentMeta;
