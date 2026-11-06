/** Form parts: Field and its controls, choice controls, pickers and form structure. */
import { Checkbox, Field, Switch } from '@tounsoo/todae';
import { useState } from 'react';
import { click, focus, many, range, type CoverageGroup, type ItemProps } from './types.tsx';

function TextInputItem({ index, tick }: ItemProps) {
  const [value, setValue] = useState('');
  return (
    <Field.Root>
      <Field.TextInput aria-label={`Field ${index} ${tick}`} value={value} onValueChange={setValue} />
    </Field.Root>
  );
}

export const FORMS = {
  Checkbox: [
    {
      id: 'checkbox',
      title: 'Checkbox',
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Checkbox.Root key={index}>
              Row {index} {tick}
            </Checkbox.Root>
          ))}
        </>
      ),
      interact: click('input[type="checkbox"]'),
    },
  ],
  Switch: [
    {
      id: 'switch',
      title: 'Switch',
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Switch.Root key={index}>
              Alerts {index} {tick}
            </Switch.Root>
          ))}
        </>
      ),
      interact: click('input'),
    },
  ],
  'Field.TextInput': [
    {
      id: 'text-input',
      title: 'Field with TextInput',
      Case: many(TextInputItem),
      interact: focus('input'),
    },
  ],
  'Field.Root': { via: 'Field.TextInput' },
} satisfies CoverageGroup;
