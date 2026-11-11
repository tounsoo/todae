import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Drilldown.Back',
  description:
    'Ghost Button.Root that goes back one view. Renders nothing at the first view. With no content it shows the back glyph.',
  props: [
    {
      name: 'aria-label',
      type: 'string',
      required: false,
      default: '"Back to {label}" when its text, not counting aria-hidden or SVG parts, has fewer than two letters or digits',
      description: 'Accessible name. Text of two or more letters or digits names the button by itself. Otherwise the backTo string from StringsProvider names it with the label of the view below, or the back string when that view has no label.',
    },
    {
      name: 'onClick',
      type: 'React.MouseEventHandler<HTMLButtonElement>',
      required: false,
      description: 'Runs before going back. Call event.preventDefault() to stay.',
    },
    {
      name: 'children',
      type: 'React.ReactNode',
      required: false,
      description: 'Button content. Without it, the back glyph from GlyphsProvider, or Todae\'s chevron pointing to the start of the line.',
    },
  ],
} as const satisfies ComponentMeta;
