import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'useMentions',
  description:
    'Mentions and slash commands in a Field.Textarea. A trigger character at the start of a word opens a suggestion list at that word; a pick replaces the word with the token text through the textarea\'s own editing, so undo works. Committed tokens are ranges of the text that move with edits, drawn behind the text through Field.Textarea\'s highlights. Spread getters onto Field.Textarea, Popover and OptionList.',
  props: [
    {
      name: 'triggers',
      type: 'readonly MentionTrigger[]',
      required: true,
      description:
        'One entry per trigger character, such as { char: "@", options } or { char: "/", position: "start", loadOptions }. Each takes options or loadOptions, filter, text for what a pick inserts, and label for the list\'s name.',
    },
    {
      name: 'value',
      type: '{ text: string; tokens: readonly MentionToken[] }',
      required: false,
      description:
        'Controlled draft: the text and its tokens, { start, end, char, value, text } ranges of it. A token that does not hold its text is left out. Set both to load or clear a draft.',
    },
    {
      name: 'defaultValue',
      type: '{ text: string; tokens: readonly MentionToken[] }',
      required: false,
      default: '{ text: "", tokens: [] }',
      description: 'Starting draft when uncontrolled.',
    },
    {
      name: 'onValueChange',
      type: '(value: { text: string; tokens: MentionToken[] }) => void',
      required: false,
      description: 'Called with the next text and its tokens together on every edit, including a pick. The tokens move with the edit, and a pick adds one.',
    },
    {
      name: 'maxLength',
      type: 'number',
      required: false,
      description: 'The textarea\'s maxLength. A pick whose text would not fit is disabled.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      required: false,
      description: 'Keeps the list closed and leaves Backspace and Delete to the textarea.',
    },
    {
      name: 'id',
      type: 'string',
      required: false,
      description: 'Base for the listbox id.',
    },
  ],
} as const satisfies ComponentMeta;
