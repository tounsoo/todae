import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, GlyphsProvider, Label } from '../index';

afterEach(cleanup);

const at = (text: string) => Temporal.PlainDateTime.from(text);
const day = (name: string) => screen.getByRole('button', { name });
const options = () => screen.getAllByRole('option').map((option) => option.textContent);
const reported = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map(([value]) => (value as Temporal.PlainDateTime).toString());

describe('Field.DateTimePicker', () => {
  it("on its own is the field's control, shows the date and time, and describes itself with them", () => {
    render(
      <>
        <Label.Root htmlFor="start">Start</Label.Root>
        <Field.Root id="start" aria-describedby="hint">
          <Field.DateTimePicker value={at('2026-10-13T21:30')} locale="en-US" />
        </Field.Root>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Start' });
    expect(button.id).toBe('start');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    const text = screen.getByText('Oct 13, 2026, 9:30 PM');
    expect(button.getAttribute('aria-describedby')!.split(' ')).toEqual(['hint', text.id]);
  });

  it('shows the placeholder while there is no date and time', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.DateTimePicker value={null} placeholder="Pick a date and time" />
      </Field.Root>,
    );
    expect(screen.getByText('Pick a date and time').hasAttribute('data-placeholder')).toBe(true);
  });

  it('sends the date and time under the field name as HTML writes one', () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Start" name="start">
          <Field.DateTimePicker value={at('2026-10-13T09:30')} />
        </Field.Root>
        <Field.Root aria-label="End" name="end">
          <Field.DateTimePicker value={at('2026-10-13T17:45:15').withCalendar('japanese')} />
        </Field.Root>
      </form>,
    );
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([
      ['start', '2026-10-13T09:30'],
      ['end', '2026-10-13T17:45:15'],
    ]);
  });

  it('beside a Field.TextInput gives it the field, and with showValue off is a glyph button named from the strings', () => {
    render(
      <form data-testid="form">
        <Label.Root htmlFor="start">Start</Label.Root>
        <Field.Root id="start">
          <Field.TextInput value="10/13/2026, 9:30 AM" onChange={() => undefined} />
          <Field.DateTimePicker value={at('2026-10-13T09:30')} name="start" showValue={false} />
        </Field.Root>
      </form>,
    );
    expect((screen.getByLabelText('Start') as HTMLInputElement).id).toBe('start');
    const button = screen.getByRole('button', { name: 'Choose date and time' });
    expect(button.hasAttribute('data-glyph-only')).toBe(true);
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([['start', '2026-10-13T09:30']]);
  });

  it('opens a dialog named from the strings, with the calendar and the list of times', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.DateTimePicker value={at('2026-10-13T09:30')} locale="en-US" defaultOpen />
      </Field.Root>,
    );
    screen.getByRole('dialog', { name: 'Choose date and time' });
    screen.getByRole('grid');
    const list = screen.getByRole('listbox', { name: 'Choose time' });
    expect(document.getElementById(list.getAttribute('aria-activedescendant')!)!.textContent).toBe('9:30 AM');
    expect(day('Tuesday, October 13, 2026').closest('td')!.getAttribute('aria-selected')).toBe('true');
  });

  it('with no value, reports once a date and a time are both picked, and closes on the time', () => {
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <Field.Root aria-label="Start">
        <Field.DateTimePicker value={null} onValueChange={onValueChange} min={at('2026-10-01T00:00')} locale="en-US" defaultOpen onOpenChange={onOpenChange} />
      </Field.Root>,
    );
    fireEvent.click(screen.getByRole('option', { name: '9:30 AM' }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    // The date comes next.
    expect(document.activeElement!.hasAttribute('data-todae-calendar-cell')).toBe(true);
    fireEvent.click(day('Tuesday, October 13, 2026'));
    // Then the time.
    expect(document.activeElement).toBe(screen.getByRole('listbox'));
    expect(reported(onValueChange)).toEqual(['2026-10-13T09:30:00']);
    // Still open: the time can change, which closes it.
    fireEvent.click(screen.getByRole('option', { name: '10:00 AM' }));
    expect(reported(onValueChange)).toEqual(['2026-10-13T09:30:00', '2026-10-13T10:00:00']);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'select');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the time when a new date is picked', () => {
    const onValueChange = vi.fn();
    render(
      <Field.Root aria-label="Start">
        <Field.DateTimePicker value={at('2026-10-13T09:30')} onValueChange={onValueChange} locale="en-US" defaultOpen />
      </Field.Root>,
    );
    fireEvent.click(day('Wednesday, October 14, 2026'));
    expect(reported(onValueChange)).toEqual(['2026-10-14T09:30:00']);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('lists only the times in range on the first and last dates, and reports nothing out of range', () => {
    const onValueChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState<Temporal.PlainDateTime | null>(at('2026-10-14T08:00'));
      return (
        <Field.Root aria-label="Start">
          <Field.DateTimePicker
            value={value}
            onValueChange={(next) => {
              onValueChange(next);
              setValue(next);
            }}
            min={at('2026-10-13T22:00')}
            max={at('2026-10-15T01:00')}
            locale="en-US"
            defaultOpen
          />
        </Field.Root>
      );
    }
    render(<Harness />);
    expect(options()).toHaveLength(48);
    // 8:00 is before the earliest time on the 13th.
    fireEvent.click(day('Tuesday, October 13, 2026'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(options()).toEqual(['10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM']);
    expect(screen.queryByRole('option', { selected: true })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: '11:00 PM' }));
    expect(reported(onValueChange)).toEqual(['2026-10-13T23:00:00']);
  });

  it('follows a value set from outside while open', () => {
    const { rerender } = render(
      <Field.Root aria-label="Start">
        <Field.DateTimePicker value={at('2026-10-13T09:30')} locale="en-US" defaultOpen />
      </Field.Root>,
    );
    rerender(
      <Field.Root aria-label="Start">
        <Field.DateTimePicker value={at('2026-10-20T14:00')} locale="en-US" defaultOpen />
      </Field.Root>,
    );
    const list = screen.getByRole('listbox');
    expect(screen.getByRole('option', { selected: true }).textContent).toBe('2:00 PM');
    expect(list.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { selected: true }).id);
  });

  it('lists the times every step minutes', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.DateTimePicker value={null} step={360} locale="en-US" defaultOpen />
      </Field.Root>,
    );
    expect(options()).toEqual(['12:00 AM', '6:00 AM', '12:00 PM', '6:00 PM']);
  });

  it('writes the date and time in the locale', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.DateTimePicker value={at('2026-10-13T21:30')} locale="ko" />
      </Field.Root>,
    );
    expect(screen.getByRole('button', { name: 'Start' }).textContent).toBe(
      at('2026-10-13T21:30').toLocaleString('ko', { dateStyle: 'medium', timeStyle: 'short' }),
    );
  });

  it('draws the calendar glyph from GlyphsProvider', () => {
    render(
      <GlyphsProvider glyphs={{ calendar: <svg data-testid="calendar" /> }}>
        <Field.Root aria-label="Start">
          <Field.DateTimePicker value={null} />
        </Field.Root>
      </GlyphsProvider>,
    );
    expect(screen.getByTestId('calendar').closest('[data-todae-glyph]')).toBeTruthy();
  });

  it('is disabled with the field, and closes when the field is disabled', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Field.Root aria-label="Start">
        <Field.DateTimePicker value={null} defaultOpen onOpenChange={onOpenChange} />
      </Field.Root>,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    rerender(
      <Field.Root aria-label="Start" disabled>
        <Field.DateTimePicker value={null} defaultOpen onOpenChange={onOpenChange} />
      </Field.Root>,
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'disabled');
  });
});
