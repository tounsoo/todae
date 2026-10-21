import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Field } from '../index.js';

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
