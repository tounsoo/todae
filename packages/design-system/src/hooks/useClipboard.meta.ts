import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useClipboard',
  description:
    'useClipboard(options?) returns { copy, status, text, reset }. copy(text) writes text with navigator.clipboard.writeText and resolves to whether it was copied. Once the latest copy settles, status is "copied" or "failed" and text is the text that copy was for, until resetAfter passes. The outcome of the latest copy is announced through useAnnouncer. There is no execCommand fallback.',
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
