import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useClipboard',
  description:
    'useClipboard(options?) returns { copy, status, reset }. copy(text) writes text with navigator.clipboard.writeText and resolves to whether it was copied; status is "idle" while a copy is pending, "copied" or "failed" once it settles, then "idle" again once resetAfter passes. Each outcome is announced through useAnnouncer. There is no execCommand fallback.',
  props: [
    {
      name: 'resetAfter',
      type: 'number | false',
      required: false,
      default: '2000',
      description: 'Milliseconds before status returns to "idle". false keeps it until the next copy or reset().',
    },
    {
      name: 'copiedMessage',
      type: 'string',
      required: false,
      description: 'Read to screen readers after a copy. Default is the copied string from StringsProvider. An empty string reads nothing.',
    },
    {
      name: 'failedMessage',
      type: 'string',
      required: false,
      description:
        'Read to screen readers, assertively, when a copy fails. Default is the copyFailed string from StringsProvider. An empty string reads nothing.',
    },
  ],
} as const satisfies ComponentMeta;
