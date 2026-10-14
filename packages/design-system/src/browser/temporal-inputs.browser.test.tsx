import { render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Field } from '../components/Field';

function Time({ initial }: { initial: string | null }) {
  const [time, setTime] = useState<Temporal.PlainTime | null>(initial ? Temporal.PlainTime.from(initial) : null);
  return (
    <>
      <Field.Root aria-label="Time">
        <Field.TimePicker locale="en-US" value={time} onValueChange={setTime} />
      </Field.Root>
      <output>{time?.toString() ?? 'none'}</output>
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

describe('Field time and date-time parts in a browser', () => {
  it('picks a time from the list with the keyboard and gives focus back to the button', async () => {
    const { container } = render(<Time initial="09:30" />);
    const button = screen.getByRole('button', { name: 'Time' });
    await userEvent.click(button);
    const list = screen.getByRole('listbox', { name: 'Choose time' });
    await expect.poll(() => document.activeElement).toBe(list);
    // The list starts at the time, and the times are every 30 minutes.
    expect(document.getElementById(list.getAttribute('aria-activedescendant')!)!.textContent).toBe('9:30 AM');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(container.querySelector('output')!.textContent).toBe('10:00:00');
    expect(screen.queryByRole('listbox')).toBeNull();
    await expect.poll(() => document.activeElement).toBe(button);
    expect(button.textContent).toBe('10:00 AM');
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
    const { container } = render(<DateTime />);
    const input = container.querySelector('input')!;
    input.focus();
    // The year is the third segment in an en-US date and time.
    await userEvent.keyboard('{ArrowRight}{ArrowRight}20261');
    expect(container.querySelector('output')!.textContent).toBe('+020261-10-07T01:30:00');
    expect(input.value).toBe('20261-10-07T01:30');
  });
});
