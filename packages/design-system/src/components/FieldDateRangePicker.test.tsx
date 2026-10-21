import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, GlyphsProvider, Label, type DateRange } from '../index.js';

afterEach(cleanup);

const date = (text: string) => Temporal.PlainDate.from(text);
const range = (start: string, end: string): DateRange => ({ start: date(start), end: date(end) });
const day = (name: string) => screen.getByRole('button', { name });
const entries = () => [...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()];

describe('Field.DateRangePicker', () => {
  it("on its own is the field's control, shows the range, and describes itself with it", () => {
    render(
      <>
        <Label.Root htmlFor="stay">Stay</Label.Root>
        <Field.Root id="stay" aria-describedby="hint">
          <Field.DateRangePicker value={range('2026-10-03', '2026-10-10')} locale="en-US" />
        </Field.Root>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Stay' });
    expect(button.id).toBe('stay');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    const [hint, textId] = button.getAttribute('aria-describedby')!.split(' ');
    expect(hint).toBe('hint');
    // Intl puts thin spaces around the dash.
    expect(document.getElementById(textId!)!.textContent).toBe('Oct 3\u2009–\u200910, 2026');
  });

  it('shows one date for a one-day range, and the placeholder for none', () => {
    const { rerender } = render(
      <Field.Root aria-label="Stay">
        <Field.DateRangePicker value={range('2026-10-03', '2026-10-03')} locale="en-US" placeholder="Pick dates" />
      </Field.Root>,
    );
    expect(screen.getByRole('button').textContent).toBe('Oct 3, 2026');
    rerender(
      <Field.Root aria-label="Stay">
        <Field.DateRangePicker value={null} locale="en-US" placeholder="Pick dates" />
      </Field.Root>,
    );
    expect(screen.getByText('Pick dates').hasAttribute('data-placeholder')).toBe(true);
  });

  it('sends the range under the field name as an ISO 8601 interval', () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Stay" name="stay">
          <Field.DateRangePicker value={range('2026-10-03', '2026-10-10')} />
        </Field.Root>
      </form>,
    );
    expect(entries()).toEqual([['stay', '2026-10-03/2026-10-10']]);
  });

  it('sends a range in another calendar as its ISO days', () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Stay" name="stay">
          <Field.DateRangePicker
            value={{ start: date('2026-10-03').withCalendar('japanese'), end: date('2026-10-10').withCalendar('japanese') }}
          />
        </Field.Root>
      </form>,
    );
    expect(entries()).toEqual([['stay', '2026-10-03/2026-10-10']]);
  });

  it('beside a Field.TextInput gives it the field, and is a glyph button named from the strings', () => {
    render(
      <form data-testid="form">
        <Label.Root htmlFor="stay">Stay</Label.Root>
        <Field.Root id="stay">
          <Field.TextInput value="10/3/2026 – 10/10/2026" onChange={() => undefined} />
          <Field.DateRangePicker value={range('2026-10-03', '2026-10-10')} name="stay" showValue={false} />
        </Field.Root>
      </form>,
    );
    expect((screen.getByLabelText('Stay') as HTMLInputElement).id).toBe('stay');
    const button = screen.getByRole('button', { name: 'Choose dates' });
    expect(button.id).not.toBe('stay');
    expect(button.textContent).toBe('');
    expect(entries()).toEqual([['stay', '2026-10-03/2026-10-10']]);
  });

  it('opens a dialog named from the strings, with the range selected', () => {
    render(
      <Field.Root aria-label="Stay">
        <Field.DateRangePicker value={range('2026-10-03', '2026-10-05')} locale="en-US" defaultOpen />
      </Field.Root>,
    );
    screen.getByRole('dialog', { name: 'Choose dates' });
    const selected = [...screen.getByRole('grid').querySelectorAll('td[aria-selected="true"]')];
    expect(selected.map((cell) => cell.textContent)).toEqual(['3', '4', '5']);
  });

  it('reports the range and closes with "select" after the second pick', () => {
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    function Picker() {
      const [value, setValue] = useState<DateRange | null>(null);
      return (
        <Field.Root aria-label="Stay">
          <Field.DateRangePicker
            value={value}
            onValueChange={(next) => {
              setValue(next);
              onValueChange(next);
            }}
            min={date('2026-10-01')}
            max={date('2026-10-31')}
            locale="en-US"
            defaultOpen
            onOpenChange={onOpenChange}
          />
        </Field.Root>
      );
    }
    render(<Picker />);
    fireEvent.click(day('Saturday, October 10, 2026'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(day('Saturday, October 3, 2026'));
    expect(onValueChange).toHaveBeenCalledWith(range('2026-10-03', '2026-10-10'));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'select');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button').textContent).toBe('Oct 3\u2009–\u200910, 2026');
  });

  it('drops a first pick on Escape and stays open, then closes on the next Escape', () => {
    const onOpenChange = vi.fn();
    render(
      <Field.Root aria-label="Stay">
        <Field.DateRangePicker
          value={range('2026-10-20', '2026-10-22')}
          locale="en-US"
          defaultOpen
          onOpenChange={onOpenChange}
        />
      </Field.Root>,
    );
    fireEvent.click(day('Monday, October 5, 2026'));
    fireEvent.keyDown(day('Monday, October 5, 2026'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(day('Tuesday, October 20, 2026').hasAttribute('data-selected')).toBe(true);
    fireEvent.keyDown(day('Monday, October 5, 2026'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'escape');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('forgets a first pick when it closes', () => {
    const { rerender } = render(
      <Field.Root aria-label="Stay">
        <Field.DateRangePicker value={null} locale="en-US" open min={date('2026-10-01')} max={date('2026-10-31')} />
      </Field.Root>,
    );
    fireEvent.click(day('Monday, October 5, 2026'));
    expect(day('Monday, October 5, 2026').hasAttribute('data-selected')).toBe(true);
    rerender(
      <Field.Root aria-label="Stay">
        <Field.DateRangePicker value={null} locale="en-US" open={false} min={date('2026-10-01')} max={date('2026-10-31')} />
      </Field.Root>,
    );
    rerender(
      <Field.Root aria-label="Stay">
        <Field.DateRangePicker value={null} locale="en-US" open min={date('2026-10-01')} max={date('2026-10-31')} />
      </Field.Root>,
    );
    expect(day('Monday, October 5, 2026').hasAttribute('data-selected')).toBe(false);
  });

  it('draws the calendar glyph from GlyphsProvider', () => {
    render(
      <GlyphsProvider glyphs={{ calendar: <svg data-testid="calendar" /> }}>
        <Field.Root aria-label="Stay">
          <Field.DateRangePicker value={null} />
        </Field.Root>
      </GlyphsProvider>,
    );
    expect(screen.getByTestId('calendar').closest('[data-todae-glyph]')).toBeTruthy();
  });

  it('is disabled with the field', () => {
    render(
      <Field.Root aria-label="Stay" disabled>
        <Field.DateRangePicker value={null} />
      </Field.Root>,
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
