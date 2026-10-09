import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Disclosure.Root',
  description: 'A native details styled from the disclosure tokens. Takes native details attributes.',
  props: [
    {
      name: 'name',
      type: 'string',
      required: false,
      description: 'Disclosures with the same name form an exclusive accordion: the browser keeps at most one open, and a rule divides them.',
    },
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Starts the disclosure open. The browser then owns the state; follow it with onToggle.',
    },
    {
      name: 'onToggle',
      type: '(event: React.ToggleEvent<HTMLDetailsElement>) => void',
      required: false,
      description: 'Called after the disclosure opens or closes.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: true,
      description: 'A Disclosure.Summary first, then the content it shows and hides.',
    },
  ],
} as const satisfies ComponentMeta;
