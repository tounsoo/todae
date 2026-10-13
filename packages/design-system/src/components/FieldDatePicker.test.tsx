import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Field, GlyphsProvider, Label } from '../index';

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

  it('sends the date as an ISO string under the field name', () => {
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

  it('beside a Field.DateInput gives it the field, and is a glyph button named from the strings', () => {
    render(
      <form data-testid="form">
        <Label.Root htmlFor="start">Start</Label.Root>
        <Field.Root id="start" name="start">
          <Field.DateInput value={date('2026-10-13')} onValueChange={() => undefined} />
          <Field.DatePicker value={date('2026-10-13')} />
        </Field.Root>
      </form>,
    );
    const input = screen.getByLabelText('Start') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.id).toBe('start');
    const button = screen.getByRole('button', { name: 'Choose date' });
    expect(button.id).not.toBe('start');
    expect(button.hasAttribute('data-beside')).toBe(true);
    expect(button.textContent).toBe('');
    expect(button.querySelector('[data-todae-glyph] svg')).toBeTruthy();
    const form = screen.getByTestId('form') as HTMLFormElement;
    expect([...new FormData(form).entries()]).toEqual([['start', '2026-10-13']]);
  });

  it('gives the field to any typed input beside a picker, so one element has its id', () => {
    render(
      <>
        <Field.Root id="typed">
          <Field.TextInput value="" onChange={() => undefined} />
          <Field.DatePicker value={null} />
        </Field.Root>
        <Field.Root id="timed">
          <Field.TimeInput value={null} onValueChange={() => undefined} />
          <Field.DatePicker value={null} />
        </Field.Root>
        <Field.Root id="tinted">
          <Field.DateInput value={null} onValueChange={() => undefined} />
          <Field.ColorPicker value="#3366ff" />
        </Field.Root>
      </>,
    );
    for (const id of ['typed', 'timed', 'tinted']) {
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1);
      expect(document.getElementById(id)!.tagName).toBe('INPUT');
    }
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
