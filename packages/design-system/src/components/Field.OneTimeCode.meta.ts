import type { ComponentMeta } from '../meta.ts';

export const meta = {
  name: 'Field.OneTimeCode',
  description:
    'A code for a sign-in or a verification, drawn as boxes over one native input. The input keeps paste, undo, selection and the phone\'s code autofill (autocomplete="one-time-code"), and the boxes are only drawn. Typing, paste and autofill all keep the characters the code allows and cut it to length; a pasted code replaces the whole value, a press on a box selects its character so typing replaces it, and typing on a full code replaces the box at the caret. className and style go on the element that draws the boxes; every other native input attribute goes on the input, except type, value, defaultValue, onChange, disabled, maxLength, minLength, pattern, inputMode and dir (the input is always left to right).',
  props: [
    {
      name: 'value',
      type: 'string',
      required: true,
      description: 'The code: at most length characters of the allowed set.',
    },
    {
      name: 'onChange',
      type: '(event: ChangeEvent<HTMLInputElement>) => void',
      required: false,
      description: 'Optional: onValueChange alone is enough when the event is not needed.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      required: false,
      description:
        'Called with the code cleaned to the allowed characters and cut to length. Without it and onChange the input is read-only.',
    },
    {
      name: 'length',
      type: 'number',
      required: false,
      default: '6',
      description: 'How many characters the code has, and how many boxes are drawn.',
    },
    {
      name: 'characters',
      type: '"digits" | "alphanumeric"',
      required: false,
      default: '"digits"',
      description: 'digits asks the phone for a numeric keypad and refuses other characters as they are typed.',
    },
    {
      name: 'className',
      type: 'string',
      required: false,
      description: 'On the element that draws the boxes, not on the input, which is transparent.',
    },
    {
      name: 'style',
      type: 'CSSProperties',
      required: false,
      description: 'On the element that draws the boxes, like className.',
    },
    {
      name: 'autoComplete',
      type: 'string',
      required: false,
      default: '"one-time-code"',
      description: 'Lets the phone offer the code from a text message.',
    },
  ],
} as const satisfies ComponentMeta;
