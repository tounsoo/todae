import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Coachmark.Root',
  description:
    'Dims the page around one element and points a popup at it. The element stays usable through a hole in the dim page; the rest is inert. One step only: a tour is the product’s sequence of coachmarks.',
  props: [
    {
      name: 'targetRef',
      type: 'React.RefObject<HTMLElement | null>',
      required: true,
      description: 'The element to highlight. It stays usable through the hole, it is scrolled into view as the coachmark opens, and the popup sits beside it.',
    },
    {
      name: 'open',
      type: 'boolean',
      required: false,
      description: 'Controlled open state. Leave it out for an uncontrolled coachmark.',
    },
    {
      name: 'defaultOpen',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'Shows the coachmark on mount when uncontrolled. There is no trigger part, so once closed it opens again only on remount.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean, reason: CoachmarkCloseReason) => void',
      required: false,
      description: 'Dismiss requests. When controlled, staying open keeps the coachmark open. Reasons: escape, backdrop, close-button.',
    },
    {
      name: 'dismissOnEscape',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Escape calls onOpenChange(false, "escape").',
    },
    {
      name: 'dismissOnBackdrop',
      type: 'boolean',
      required: false,
      default: 'false',
      description: 'A press on the dim page calls onOpenChange(false, "backdrop"). Off by default, so a stray press doesn’t end a tour.',
    },
    {
      name: 'initialFocusRef',
      type: 'React.RefObject<HTMLElement | null>',
      required: false,
      description: 'Where focus goes as it opens. Without it, the popup’s first tab stop, else the popup.',
    },
    {
      name: 'restoreFocusRef',
      type: 'React.RefObject<HTMLElement | null>',
      required: false,
      description: 'Where focus goes as it closes. Without it, back to what had focus before it opened.',
    },
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      description: 'Name when Coachmark.Title is omitted.',
    },
    {
      name: 'arrows',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Whether arrows show at the popup’s cut-off edges when it scrolls, as on Popover.Root.',
    },
  ],
} as const satisfies ComponentMeta;
