import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: "createToaster",
  description:
    "Returns a toast store { add, update, dismiss, remove, subscribe, getSnapshot } that works outside React. Make one per app at module scope and pass it to Toast.Region. add() takes id, tone, title, description, duration and any fields of your own, and returns the id; an id that is still showing is replaced in place.",
  props: [
    {
      name: "duration",
      type: "number",
      required: false,
      default: "5000",
      description: "Default milliseconds before a toast dismisses itself. Infinity keeps toasts until dismissed.",
    },
  ],
} as const satisfies ComponentMeta;
