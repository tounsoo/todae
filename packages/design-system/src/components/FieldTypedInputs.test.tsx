import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, Label, formatDateRange } from '../index.js';

afterEach(cleanup);

const date = (text: string) => Temporal.PlainDate.from(text);
const sent = (form: HTMLFormElement) => [...new FormData(form).entries()];

function DateField({
  initial = null,
  onValueChange,
  ...props
}: {
  initial?: Temporal.PlainDate | null;
  onValueChange?: (value: Temporal.PlainDate | null) => void;
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  required?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form data-testid="form">
      <Label.Root htmlFor="day">Day</Label.Root>
      <Field.Root id="day" name="day">
        <Field.DateInput
          {...props}
          locale="en-US"
          value={value}
          onValueChange={(next) => {
            setValue(next);
            onValueChange?.(next);
          }}
        />
      </Field.Root>
    </form>
  );
}

describe('Field.DateInput', () => {
  it("is the field's text input and sends the ISO date under the field's name", () => {
    render(<DateField initial={date('2026-10-13')} />);
    const input = screen.getByLabelText('Day') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.id).toBe('day');
    expect(input.name).toBe('');
    expect(input.value).toBe('10/13/2026');
    expect(sent(screen.getByTestId('form') as HTMLFormElement)).toEqual([['day', '2026-10-13']]);
  });

  it('fires nothing while typing, and commits on blur with the text rewritten', () => {
    const onValueChange = vi.fn();
    render(<DateField onValueChange={onValueChange} />);
    const input = screen.getByLabelText('Day') as HTMLInputElement;
    // A year of one digit reads as a date, so typing alone must not fire.
    fireEvent.change(input, { target: { value: '10/13/2' } });
    fireEvent.change(input, { target: { value: 'Oct 13, 2026' } });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0].toString()).toBe('2026-10-13');
    expect(input.value).toBe('10/13/2026');
  });

  it('holds a readable draft in its value input before the commit, so a form checked before its submit event sees it', () => {
    render(<DateField required />);
    const input = screen.getByLabelText('Day');
    const form = screen.getByTestId('form') as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);
    fireEvent.change(input, { target: { value: '10/20/2026' } });
    expect(form.checkValidity()).toBe(true);
    expect(sent(form)).toEqual([['day', '2026-10-20']]);
  });

  it('commits on Enter', () => {
    const onValueChange = vi.fn();
    render(<DateField onValueChange={onValueChange} />);
    const input = screen.getByLabelText('Day');
    fireEvent.change(input, { target: { value: '10/13/2026' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('keeps text that is no date, flags it once a commit tried, and blocks the form', () => {
    const onValueChange = vi.fn();
    render(<DateField onValueChange={onValueChange} />);
    const input = screen.getByLabelText('Day') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'soon' } });
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    const form = screen.getByTestId('form') as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);
    fireEvent.blur(input);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe('soon');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('commits an empty text as null', () => {
    const onValueChange = vi.fn();
    render(<DateField initial={date('2026-10-13')} onValueChange={onValueChange} />);
    const input = screen.getByLabelText('Day');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it('puts min, max and required on the value input', () => {
    render(<DateField initial={date('2026-10-13')} min={date('2026-10-14')} max={date('2026-12-31')} required />);
    const valueInput = document.querySelector<HTMLInputElement>('input[data-todae-value-input]')!;
    expect(valueInput.type).toBe('date');
    expect(valueInput.min).toBe('2026-10-14');
    expect(valueInput.max).toBe('2026-12-31');
    expect(valueInput.required).toBe(true);
    expect(valueInput.validity.rangeUnderflow).toBe(true);
    expect(screen.getByLabelText('Day').getAttribute('aria-required')).toBe('true');
  });

  it('is read-only without onValueChange', () => {
    render(
      <Field.Root aria-label="Day">
        <Field.DateInput value={date('2026-10-13')} locale="en-US" />
      </Field.Root>,
    );
    expect((screen.getByLabelText('Day') as HTMLInputElement).readOnly).toBe(true);
  });

  it('shows a new value set from outside over what was typed', () => {
    function Outside() {
      const [value, setValue] = useState<Temporal.PlainDate | null>(null);
      return (
        <>
          <Field.Root aria-label="Day">
            <Field.DateInput value={value} onValueChange={setValue} locale="en-US" />
          </Field.Root>
          <button type="button" onClick={() => setValue(date('2026-01-02'))}>
            Set
          </button>
        </>
      );
    }
    render(<Outside />);
    const input = screen.getByLabelText('Day') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'half typed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(input.value).toBe('1/2/2026');
  });
});

describe('Field.TimeInput', () => {
  it('reads the time on blur and sends it as HTML writes it', () => {
    const onValueChange = vi.fn();
    function TimeField() {
      const [value, setValue] = useState<Temporal.PlainTime | null>(null);
      return (
        <form data-testid="form">
          <Field.Root aria-label="Start" name="start">
            <Field.TimeInput
              value={value}
              locale="en-US"
              onValueChange={(next) => {
                setValue(next);
                onValueChange(next);
              }}
            />
          </Field.Root>
        </form>
      );
    }
    render(<TimeField />);
    const input = screen.getByLabelText('Start') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9:30 pm' } });
    fireEvent.blur(input);
    expect(onValueChange.mock.calls[0]![0].toString()).toBe('21:30:00');
    expect(input.value).toBe('9:30 PM');
    expect(sent(screen.getByTestId('form') as HTMLFormElement)).toEqual([['start', '21:30']]);
    const valueInput = document.querySelector<HTMLInputElement>('input[data-todae-value-input]')!;
    expect(valueInput.type).toBe('time');
    expect(valueInput.step).toBe('any');
  });
});

describe('Field.DateTimeInput', () => {
  it('reads the date and time on blur and sends them as HTML writes them', () => {
    function AtField() {
      const [value, setValue] = useState<Temporal.PlainDateTime | null>(null);
      return (
        <form data-testid="form">
          <Field.Root aria-label="At" name="at">
            <Field.DateTimeInput value={value} onValueChange={setValue} locale="en-US" />
          </Field.Root>
        </form>
      );
    }
    render(<AtField />);
    const input = screen.getByLabelText('At') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '10/13/2026 9:30 pm' } });
    fireEvent.blur(input);
    expect(input.value).toBe('10/13/2026, 9:30 PM');
    expect(sent(screen.getByTestId('form') as HTMLFormElement)).toEqual([['at', '2026-10-13T21:30']]);
  });
});

describe('Field.DateRangeInput', () => {
  function RangeField({ min, max }: { min?: Temporal.PlainDate; max?: Temporal.PlainDate }) {
    const [value, setValue] = useState<{ start: Temporal.PlainDate; end: Temporal.PlainDate } | null>(null);
    return (
      <form data-testid="form">
        <Field.Root aria-label="Stay" name="stay">
          <Field.DateRangeInput value={value} onValueChange={setValue} min={min} max={max} locale="en-US" />
        </Field.Root>
      </form>
    );
  }

  it('reads the range on blur and sends it as an ISO 8601 interval', () => {
    render(<RangeField />);
    const input = screen.getByLabelText('Stay') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '10/10/2026 – 10/3/2026' } });
    fireEvent.blur(input);
    expect(input.value).toBe(formatDateRange({ start: date('2026-10-03'), end: date('2026-10-10') }, { locale: 'en-US' }));
    expect(sent(screen.getByTestId('form') as HTMLFormElement)).toEqual([['stay', '2026-10-03/2026-10-10']]);
  });

  it.each([
    ['starts before min', { min: date('2026-10-05') }, 'Enter 10/5/2026 or later'],
    ['ends after max', { max: date('2026-10-08') }, 'Enter 10/8/2026 or earlier'],
  ])('blocks the form with a range that %s, and names the bound', (_, bounds, message) => {
    render(<RangeField {...bounds} />);
    const input = screen.getByLabelText('Stay');
    fireEvent.change(input, { target: { value: '10/3/2026 – 10/10/2026' } });
    fireEvent.blur(input);
    expect((screen.getByTestId('form') as HTMLFormElement).checkValidity()).toBe(false);
    expect(document.querySelector<HTMLInputElement>('input[data-todae-value-input]')!.validationMessage).toBe(message);
  });
});
