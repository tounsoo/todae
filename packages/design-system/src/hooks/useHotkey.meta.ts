import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useHotkey',
  description:
    'useHotkey(hotkey, handler, options). Listens for keydown on the document and runs handler when a key matches hotkey, after preventing its default. It skips keys something else already prevented, keys pressed while an IME composes, held keys, and keys that would type into the focused field.',
  props: [
    {
      name: 'hotkey',
      type: 'string | readonly string[]',
      required: true,
      description:
        'A key with its modifiers, such as "Control+K", "Alt+T" or "F8". Modifiers must match exactly. A list matches any of them. One with a modifier name it does not know is off.',
    },
    {
      name: 'handler',
      type: '(event: KeyboardEvent) => void',
      required: true,
      description: 'Runs on a match. An inline function is fine; the latest one is read at key time.',
    },
    {
      name: 'enabled',
      type: 'boolean',
      required: false,
      default: 'true',
      description: 'Listen only while true. Pass it in the options object.',
    },
  ],
} as const satisfies ComponentMeta;
