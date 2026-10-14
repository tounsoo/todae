import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Nav.Branch',
  description: 'A native details with a toggle and a nested list. Takes native details attributes.',
  props: [
    {
      name: 'label',
      type: 'React.ReactNode',
      required: true,
      description: 'The toggle\'s text. After a Nav.Link in the same item, the toggle shows only a chevron and this text only names it, so name the child pages, such as "Field pages".',
    },
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Opens the branch when it renders or changes to true. The browser then owns the state; follow it with onToggle.',
    },
    {
      name: 'onToggle',
      type: '(event: React.ToggleEvent<HTMLDetailsElement>) => void',
      required: false,
      description: 'Called after the branch opens or closes.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Nav.Item elements, the child pages.',
    },
  ],
} as const satisfies ComponentMeta;
