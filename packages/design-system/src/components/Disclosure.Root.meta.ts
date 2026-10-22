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
      description: 'Whether the disclosure is open. A change to the prop opens or closes it, and between changes the person\'s own toggles stand; follow them with onToggle.',
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
      required: false,
      description: 'A Disclosure.Summary first, then the content it shows and hides.',
    },
  ],
} as const satisfies ComponentMeta;
