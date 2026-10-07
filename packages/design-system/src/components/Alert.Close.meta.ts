import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Alert.Close',
  description: 'Ghost Button.Root at the end of the first row. The alert has no open state, so remove it in onClick.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Dismiss" when the button has no text of its own',
      description: 'Accessible name. Visible text such as "Got it" names the button by itself.',
    },
    {
      name: 'onClick',
      type: 'React.MouseEventHandler<HTMLButtonElement>',
      required: false,
      description: 'Hide the alert here.',
    },
  ],
} as const satisfies ComponentMeta;
