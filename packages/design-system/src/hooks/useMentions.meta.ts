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
      type: 'string',
      required: false,
      description: 'Controlled text.',
    },
    {
      name: 'defaultValue',
      type: 'string',
      required: false,
      default: '""',
      description: 'Starting text when uncontrolled.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      required: false,
      description: 'Called with the new text on every edit, including a pick.',
    },
    {
      name: 'tokens',
      type: 'readonly MentionToken[]',
      required: false,
      description: 'Controlled tokens: { start, end, char, value, text } ranges of the text. Pass them with value to load a draft.',
    },
    {
      name: 'defaultTokens',
      type: 'readonly MentionToken[]',
      required: false,
      description: 'Starting tokens when uncontrolled.',
    },
    {
      name: 'onTokensChange',
      type: '(tokens: MentionToken[]) => void',
      required: false,
      description: 'Called when a pick adds a token, or an edit moves or drops one.',
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
      description: 'Keeps the list closed.',
    },
    {
      name: 'id',
      type: 'string',
      required: false,
      description: 'Base for the listbox id.',
    },
  ],
} as const satisfies ComponentMeta;
