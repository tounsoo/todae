import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Field, GlyphsProvider, Label, useField } from '../index.js';

afterEach(cleanup);

const date = (text: string) => Temporal.PlainDate.from(text);

describe('Field.DatePicker', () => {
  it("on its own is the field's control, shows the date, and describes itself with it", () => {
    render(
      <>
        <Label.Root htmlFor="start">Start</Label.Root>
        <Field.Root id="start" aria-describedby="hint">
          <Field.DatePicker value={date('2026-10-13')} locale="en-US" />
        </Field.Root>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Start' });
    expect(button.id).toBe('start');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.hasAttribute('aria-controls')).toBe(false);
    const text = screen.getByText('Oct 13, 2026');
    expect(button.getAttribute('aria-describedby')!.split(' ')).toEqual(['hint', text.id]);
  });

  it('shows the placeholder while there is no date', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.DatePicker value={null} placeholder="Pick a date" />
      </Field.Root>,
    );
    expect(screen.getByText('Pick a date').hasAttribute('data-placeholder')).toBe(true);
  });

  it('sends the date under the field name', () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Start" name="start">
          <Field.DatePicker value={date('2026-10-13')} />
        </Field.Root>
      </form>,
    );
    const form = screen.getByTestId('form') as HTMLFormElement;
    expect([...new FormData(form).entries()]).toEqual([['start', '2026-10-13']]);
  });

  it('beside a Field.TextInput gives it the field, and with showValue off is a glyph button named from the strings', () => {
    render(
      <form data-testid="form">
        <Label.Root htmlFor="start">Start</Label.Root>
        <Field.Root id="start">
          <Field.TextInput value="10/13/2026" onChange={() => undefined} />
          <Field.DatePicker value={date('2026-10-13')} name="start" showValue={false} />
        </Field.Root>
      </form>,
    );
    const input = screen.getByLabelText('Start') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.id).toBe('start');
    const button = screen.getByRole('button', { name: 'Choose date' });
    expect(button.id).not.toBe('start');
    expect(button.hasAttribute('data-glyph-only')).toBe(true);
    expect(button.textContent).toBe('');
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    expect(button.querySelector('[data-todae-glyph] svg')).toBeTruthy();
    // The picker's own name sends the ISO date, whatever the text says.
    const form = screen.getByTestId('form') as HTMLFormElement;
    expect([...new FormData(form).entries()]).toEqual([['start', '2026-10-13']]);
  });

  it('with showValue off on its own is a glyph button named by the field', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.DatePicker value={date('2026-10-13')} showValue={false} placeholder="Pick a date" />
      </Field.Root>,
    );
    const button = screen.getByRole('button', { name: 'Start' });
    expect(button.textContent).toBe('');
    expect(screen.queryByText('Pick a date')).toBeNull();
  });

  type Pair = {
    name: string;
    input: ReactNode;
    picker: 'date' | 'color';
    inputEntry: [string, string];
  };
  const day = date('2026-10-13');
  const PAIRS: Pair[] = [
    { name: 'TextInput + ColorPicker', input: <Field.TextInput value="#3366ff" onChange={() => undefined} />, picker: 'color', inputEntry: ['f', '#3366ff'] },
    { name: 'Textarea + ColorPicker', input: <Field.Textarea value="#3366ff" onChange={() => undefined} />, picker: 'color', inputEntry: ['f', '#3366ff'] },
    { name: 'TextInput + DatePicker', input: <Field.TextInput value="note" onChange={() => undefined} />, picker: 'date', inputEntry: ['f', 'note'] },
  ];

  it.each(PAIRS)('$name: the input takes the id and the field name, and the date picker still shows its date', ({ input, picker, inputEntry }) => {
    const pickerEl =
      picker === 'date' ? <Field.DatePicker value={day} locale="en-US" /> : <Field.ColorPicker value="#3366ff" />;
    const tree = (withInput: boolean) => (
      <form data-testid="form">
        <Label.Root htmlFor="f">Field</Label.Root>
        <Field.Root id="f" name="f" aria-describedby="hint">
          {withInput ? input : null}
          {pickerEl}
        </Field.Root>
      </form>
    );
    const { rerender } = render(tree(true));
    expect(document.querySelectorAll('#f')).toHaveLength(1);
    expect(document.getElementById('f')!.tagName).toMatch(/^(INPUT|TEXTAREA)$/);
    const button = screen.getByRole('button', { name: picker === 'date' ? 'Choose date' : 'Color picker' });
    const pickerEntry: [string, string] = ['f', picker === 'date' ? '2026-10-13' : '#3366ff'];
    // The field's name is the input's: the picker sends nothing without a name of its own.
    const entries = [...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()];
    expect(entries).toEqual([inputEntry]);
    if (picker === 'date') {
      const text = screen.queryByText('Oct 13, 2026');
      expect(button.hasAttribute('data-glyph-only')).toBe(false);
      expect(button.getAttribute('aria-describedby')).toBe(text!.id);
    }
    // Without the input, the picker is the field's control again.
    rerender(tree(false));
    const alone = screen.getByRole('button', { name: 'Field' });
    expect(alone.id).toBe('f');
    expect(alone.getAttribute('aria-describedby')!.split(' ')[0]).toBe('hint');
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([pickerEntry]);
    if (picker === 'date') expect(alone.textContent).toBe('Oct 13, 2026');
  });

  it('beside a typed input of another kind sends its value under its own name, and is invalid with the field', () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Start" name="time" invalid>
          <Field.TextInput value="09:30" onChange={() => undefined} />
          <Field.DatePicker value={day} name="day" />
        </Field.Root>
      </form>,
    );
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([
      ['time', '09:30'],
      ['day', '2026-10-13'],
    ]);
    expect(screen.getByRole('button', { name: 'Choose date' }).getAttribute('aria-invalid')).toBe('true');
  });

  it("keeps the field's name beside a control that does not carry it", () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Start" name="day">
          <Field.TextInput name="time" value="09:30" onChange={() => undefined} />
          <Field.DatePicker value={day} />
        </Field.Root>
      </form>,
    );
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([
      ['time', '09:30'],
      ['day', '2026-10-13'],
    ]);
  });

  it('gives the field to a custom control wired with useField, and still shows its date', () => {
    function Custom() {
      const field = useField();
      return <input {...field.getControlProps({})} />;
    }
    render(
      <Field.Root id="f" aria-label="Start">
        <Custom />
        <Field.DatePicker value={day} />
      </Field.Root>,
    );
    const button = screen.getByRole('button', { name: 'Choose date' });
    expect(button.id).not.toBe('f');
    expect(document.querySelectorAll('#f')).toHaveLength(1);
    expect(button.hasAttribute('data-glyph-only')).toBe(false);
    expect(button.textContent).toContain('2026');
  });

  it('shows and sends a date in another calendar as its ISO day', () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Start" name="day">
          <Field.DatePicker value={day.withCalendar('japanese')} locale="en-US" />
        </Field.Root>
      </form>,
    );
    expect(screen.getByRole('button').textContent).toContain('Oct 13, 2026');
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([['day', '2026-10-13']]);
  });

  it('sends a year past 9999 as a date input does', () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Start" name="day">
          <Field.DatePicker value={date('+020261-10-07')} />
        </Field.Root>
      </form>,
    );
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([['day', '20261-10-07']]);
  });

  it('draws the calendar glyph from GlyphsProvider', () => {
    render(
      <GlyphsProvider glyphs={{ calendar: <svg data-testid="calendar" /> }}>
        <Field.Root aria-label="Start">
          <Field.DatePicker value={null} />
        </Field.Root>
      </GlyphsProvider>,
    );
    expect(screen.getByTestId('calendar').closest('[data-todae-glyph]')).toBeTruthy();
  });

  it('is disabled with the field', () => {
    render(
      <Field.Root aria-label="Start" disabled>
        <Field.DatePicker value={null} />
      </Field.Root>,
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
