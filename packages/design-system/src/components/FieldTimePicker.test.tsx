import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, GlyphsProvider, Label } from '../index';

afterEach(cleanup);

const time = (text: string) => Temporal.PlainTime.from(text);
const options = () => screen.getAllByRole('option').map((option) => option.textContent);

describe('Field.TimePicker', () => {
  it("on its own is the field's control, shows the time, and describes itself with it", () => {
    render(
      <>
        <Label.Root htmlFor="start">Start</Label.Root>
        <Field.Root id="start" aria-describedby="hint">
          <Field.TimePicker value={time('21:30')} locale="en-US" />
        </Field.Root>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Start' });
    expect(button.id).toBe('start');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const text = screen.getByText('9:30 PM');
    expect(button.getAttribute('aria-describedby')!.split(' ')).toEqual(['hint', text.id]);
  });

  it('shows the placeholder while there is no time', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.TimePicker value={null} placeholder="Pick a time" />
      </Field.Root>,
    );
    expect(screen.getByText('Pick a time').hasAttribute('data-placeholder')).toBe(true);
  });

  it('sends the time under the field name as HTML writes one', () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Start" name="start">
          <Field.TimePicker value={time('09:30')} />
        </Field.Root>
        <Field.Root aria-label="End" name="end">
          <Field.TimePicker value={time('17:45:15')} />
        </Field.Root>
      </form>,
    );
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([
      ['start', '09:30'],
      ['end', '17:45:15'],
    ]);
  });

  it('beside a Field.TextInput gives it the field, and with showValue off is a glyph button named from the strings', () => {
    render(
      <form data-testid="form">
        <Label.Root htmlFor="start">Start</Label.Root>
        <Field.Root id="start">
          <Field.TextInput value="9:30 AM" onChange={() => undefined} />
          <Field.TimePicker value={time('09:30')} name="start" showValue={false} />
        </Field.Root>
      </form>,
    );
    expect((screen.getByLabelText('Start') as HTMLInputElement).id).toBe('start');
    const button = screen.getByRole('button', { name: 'Choose time' });
    expect(button.hasAttribute('data-glyph-only')).toBe(true);
    expect(button.textContent).toBe('');
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([['start', '09:30']]);
  });

  it('lists the times every step minutes between min and max, with the time among them', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.TimePicker
          value={time('09:07')}
          min={time('08:30')}
          max={time('10:00')}
          step={15}
          locale="en-US"
          defaultOpen
        />
      </Field.Root>,
    );
    expect(screen.getByRole('listbox', { name: 'Choose time' })).toBeTruthy();
    expect(options()).toEqual(['8:30 AM', '8:45 AM', '9:00 AM', '9:07 AM', '9:15 AM', '9:30 AM', '9:45 AM', '10:00 AM']);
    expect(screen.getByRole('option', { selected: true }).textContent).toBe('9:07 AM');
  });

  it('lists every 30 minutes for a step that is not a number of minutes', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.TimePicker value={null} step={0} max={time('01:00')} locale="en-US" defaultOpen />
      </Field.Root>,
    );
    expect(options()).toEqual(['12:00 AM', '12:30 AM', '1:00 AM']);
  });

  it('leaves out a time outside min and max', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.TimePicker value={time('07:00')} min={time('08:00')} max={time('09:00')} locale="en-US" defaultOpen />
      </Field.Root>,
    );
    expect(options()).toEqual(['8:00 AM', '8:30 AM', '9:00 AM']);
  });

  it('fires onValueChange with a picked time and closes with select', () => {
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <Field.Root aria-label="Start">
        <Field.TimePicker
          value={null}
          onValueChange={onValueChange}
          max={time('01:00')}
          locale="en-US"
          defaultOpen
          onOpenChange={onOpenChange}
        />
      </Field.Root>,
    );
    fireEvent.click(screen.getByRole('option', { name: '12:30 AM' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect((onValueChange.mock.calls[0]![0] as Temporal.PlainTime).equals(time('00:30'))).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'select');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('writes the times in the locale', () => {
    render(
      <Field.Root aria-label="Start">
        <Field.TimePicker value={time('21:30')} max={time('00:30')} locale="ko" defaultOpen />
      </Field.Root>,
    );
    expect(screen.getByRole('button', { name: 'Start' }).textContent).toBe(time('21:30').toLocaleString('ko', { timeStyle: 'short' }));
  });

  it('draws the clock glyph from GlyphsProvider', () => {
    render(
      <GlyphsProvider glyphs={{ clock: <svg data-testid="clock" /> }}>
        <Field.Root aria-label="Start">
          <Field.TimePicker value={null} />
        </Field.Root>
      </GlyphsProvider>,
    );
    expect(screen.getByTestId('clock').closest('[data-todae-glyph]')).toBeTruthy();
  });

  it('is disabled with the field, and closes when the field is disabled', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Field.Root aria-label="Start">
        <Field.TimePicker value={null} defaultOpen onOpenChange={onOpenChange} />
      </Field.Root>,
    );
    expect(screen.getByRole('listbox')).toBeTruthy();
    rerender(
      <Field.Root aria-label="Start" disabled>
        <Field.TimePicker value={null} defaultOpen onOpenChange={onOpenChange} />
      </Field.Root>,
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'disabled');
  });
});
