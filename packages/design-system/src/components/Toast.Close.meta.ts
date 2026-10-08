import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: "Toast.Close",
  description:
    "Ghost Button.Root at the end of the first row that dismisses the toast.",
  props: [
    {
      name: "aria-label",
      type: "string",
      required: false,
      default: "\"Dismiss\" when the button has no text of its own",
      description: "Accessible name. Visible text names the button by itself. The default is English, so pass a name in your app's language.",
    },
    {
      name: "onClick",
      type: "React.MouseEventHandler<HTMLButtonElement>",
      required: false,
      description: "Runs before the toast is dismissed. Call event.preventDefault() to keep it open.",
    },
  ],
} as const satisfies ComponentMeta;
