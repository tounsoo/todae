import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { Field, useField } from '../index.js';

afterEach(cleanup);

const noop = () => undefined;

function entries(ui: ReactNode) {
  render(<form data-testid="form">{ui}</form>);
  return [...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()];
}

// What each control sends is the same as when it carried its value in a hidden input.
describe('what a form submits', () => {
  it.each([
    ['a date', <Field.DatePicker value={Temporal.PlainDate.from('2026-10-13')} />, '2026-10-13'],
    ['no date', <Field.DatePicker value={null} />, ''],
    ['a date past year 9999', <Field.DatePicker value={Temporal.PlainDate.from('+020261-10-07')} />, '20261-10-07'],
    ['a time', <Field.TimePicker value={Temporal.PlainTime.from('09:30')} />, '09:30'],
    ['a time with seconds', <Field.TimePicker value={Temporal.PlainTime.from('09:30:15')} />, '09:30:15'],
    ['no time', <Field.TimePicker value={null} />, ''],
    ['a date and time', <Field.DateTimePicker value={Temporal.PlainDateTime.from('2026-10-13T09:30')} />, '2026-10-13T09:30'],
    ['no date and time', <Field.DateTimePicker value={null} />, ''],
    ['a color as typed', <Field.ColorPicker value="#3366FF" />, '#3366FF'],
  ])('%s', (_, picker, sent) => {
    expect(entries(<Field.Root aria-label="Value" name="v">{picker}</Field.Root>)).toEqual([['v', sent]]);
  });

  it('sends nothing for a picker with no name, or in a disabled field', () => {
    const day = Temporal.PlainDate.from('2026-10-13');
    expect(entries(<Field.Root aria-label="Value"><Field.DatePicker value={day} /></Field.Root>)).toEqual([]);
    cleanup();
    expect(
      entries(
        <Field.Root aria-label="Value" name="v" disabled>
          <Field.DatePicker value={day} />
        </Field.Root>,
      ),
    ).toEqual([]);
  });

  it('sends a ChipInput as the text being typed, not its chips', () => {
    expect(
      entries(
        <Field.Root aria-label="Tags" name="tags">
          <Field.ChipInput chips={['a', 'b']} inputValue="dr" onInputValueChange={noop} onCommit={noop} onChipRemove={noop} />
        </Field.Root>,
      ),
    ).toEqual([['tags', 'dr']]);
  });
});

// The server cannot know which control took the field's name, so the control itself says.
describe('on the server', () => {
  function Stars() {
    const field = useField();
    const control = field.getControlProps({ 'aria-label': 'Stars' });
    return (
      <>
        <input {...control} defaultValue="typed" />
        <input {...field.getValueInputProps({ type: 'text', value: '3' }, control)} />
      </>
    );
  }

  it('names the field once when a control that sends is beside its value input', () => {
    const html = renderToString(
      <Field.Root name="stars" aria-label="Stars">
        <Stars />
      </Field.Root>,
    );
    expect(html.match(/name="stars"/g)).toHaveLength(1);
  });

  it('names a ChipInput\'s text and no more, whatever its value input holds', () => {
    const html = renderToString(
      <Field.Root name="tags" aria-label="Tags">
        <Field.ChipInput chips={['a']} inputValue="" onInputValueChange={noop} onCommit={noop} onChipRemove={noop} />
      </Field.Root>,
    );
    expect(html.match(/name="tags"/g)).toHaveLength(1);
  });
});
