import { render } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Field } from '../components/Field';

function Time({ step, initial }: { step?: number; initial: string }) {
  const [time, setTime] = useState<Temporal.PlainTime | null>(Temporal.PlainTime.from(initial));
  return (
    <>
      <Field.Root aria-label="Time">
        <Field.TimeInput step={step} value={time} onValueChange={setTime} />
      </Field.Root>
      <output>{time?.toString() ?? 'none'}</output>
    </>
  );
}

function DateField() {
  const [date, setDate] = useState<Temporal.PlainDate | null>(Temporal.PlainDate.from('2026-10-07'));
  return (
    <>
      <Field.Root aria-label="Date">
        <Field.DateInput value={date} onValueChange={setDate} />
      </Field.Root>
      <output>{date?.toString() ?? 'none'}</output>
    </>
  );
}

function DateTime() {
  const [start, setStart] = useState<Temporal.PlainDateTime | null>(Temporal.PlainDateTime.from('2026-10-07T01:30'));
  return (
    <>
      <Field.Root aria-label="Start">
        <Field.DateTimeInput step={1} value={start} onValueChange={setStart} />
      </Field.Root>
      <output>{start?.toString() ?? 'none'}</output>
    </>
  );
}

describe('Field date and time inputs in a browser', () => {
  it('keeps typing intact in a time input that shows seconds', async () => {
    const { container } = render(<Time step={1} initial="01:30" />);
    const input = container.querySelector('input')!;
    await userEvent.click(input);
    input.focus();
    // The first segment is the hour: two digits move on to the minutes.
    await userEvent.keyboard('14');
    expect(container.querySelector('output')!.textContent).toBe('14:30:00');
    await userEvent.keyboard('45');
    expect(container.querySelector('output')!.textContent).toBe('14:45:00');
  });

  it('keeps typing intact in a date and time input that shows seconds', async () => {
    const { container } = render(<DateTime />);
    const input = container.querySelector('input')!;
    input.focus();
    // Month, day and year come first in en-US; three moves reach the hour.
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}14');
    expect(container.querySelector('output')!.textContent).toBe('2026-10-07T14:30:00');
  });

  it('reads and shows a year past 9999', async () => {
    const { container } = render(<DateField />);
    const input = container.querySelector('input')!;
    input.focus();
    // The year is the last segment in an en-US date.
    await userEvent.keyboard('{ArrowRight}{ArrowRight}20261');
    expect(container.querySelector('output')!.textContent).toBe('+020261-10-07');
    expect(input.value).toBe('20261-10-07');
  });
});
