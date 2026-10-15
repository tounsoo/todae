import { render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Field } from '../components/Field.js';

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
        <Field.DateTimePicker locale="en-US" value={start} onValueChange={setStart} />
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

  it('picks a date, then a time, with the keyboard, and gives focus back to the button', async () => {
    const { container } = render(<DateTime />);
    const output = () => container.querySelector('output')!.textContent;
    const button = screen.getByRole('button', { name: 'Start' });
    await userEvent.click(button);
    screen.getByRole('dialog', { name: 'Choose date and time' });
    await expect.poll(() => document.activeElement?.textContent).toBe('7');
    // A new date keeps the time, and the list of times takes focus.
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(output()).toBe('2026-10-08T01:30:00');
    const list = screen.getByRole('listbox', { name: 'Choose time' });
    await expect.poll(() => document.activeElement).toBe(list);
    expect(document.getElementById(list.getAttribute('aria-activedescendant')!)!.textContent).toBe('1:30 AM');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(output()).toBe('2026-10-08T02:00:00');
    expect(screen.queryByRole('dialog')).toBeNull();
    await expect.poll(() => document.activeElement).toBe(button);
    expect(button.textContent).toBe('Oct 8, 2026, 2:00 AM');
  });
});
