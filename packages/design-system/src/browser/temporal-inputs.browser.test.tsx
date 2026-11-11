import { render, screen } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Calendar } from '../components/Calendar.js';
import { Field } from '../components/Field.js';
import { OptionList } from '../components/OptionList.js';
import { timeOptions } from '../components/timeOptions.js';

function Times({ value, onPick }: { value: Temporal.PlainTime | null; onPick: (time: Temporal.PlainTime) => void }) {
  return (
    <OptionList.Root aria-label="Times" value={value?.toString() ?? null} onValueChange={(next) => onPick(Temporal.PlainTime.from(next))}>
      {timeOptions({ value, locale: 'en-US' }).map((option) => (
        <OptionList.Option key={option.value} value={option.value}>
          {option.label}
        </OptionList.Option>
      ))}
    </OptionList.Root>
  );
}

function Time({ initial }: { initial: string | null }) {
  const [time, setTime] = useState<Temporal.PlainTime | null>(initial ? Temporal.PlainTime.from(initial) : null);
  return (
    <>
      <Field.Root aria-label="Time">
        <Field.TimeInput locale="en-US" value={time} onValueChange={setTime} />
        <Field.Picker>
          <Times value={time} onPick={setTime} />
        </Field.Picker>
      </Field.Root>
      <output>{time?.toString() ?? 'none'}</output>
    </>
  );
}

// A Calendar and a list of times in one Field.Picker: a date keeps the time, and a time closes it.
function DateTime() {
  const [start, setStart] = useState<Temporal.PlainDateTime | null>(Temporal.PlainDateTime.from('2026-10-07T01:30'));
  return (
    <>
      <Field.Root aria-label="Start">
        <Field.DateTimeInput locale="en-US" value={start} onValueChange={setStart} />
        <Field.Picker closeOnPick={false}>
          {({ close }) => (
            <>
              <Calendar.Root
                locale="en-US"
                value={start?.toPlainDate() ?? null}
                onValueChange={(day) => setStart(day.toPlainDateTime(start?.toPlainTime()))}
              >
                <Calendar.Header />
                <Calendar.Grid />
              </Calendar.Root>
              <Times
                value={start?.toPlainTime() ?? null}
                onPick={(time) => {
                  if (start) setStart(start.toPlainDate().toPlainDateTime(time));
                  close();
                }}
              />
            </>
          )}
        </Field.Picker>
      </Field.Root>
      <output>{start?.toString() ?? 'none'}</output>
    </>
  );
}

describe('Field.Picker with times in a browser', () => {
  it('picks a time from the list with the keyboard and gives focus back to the button', async () => {
    const { container } = render(<Time initial="09:30" />);
    const input = screen.getByRole('textbox', { name: 'Time' }) as HTMLInputElement;
    const button = screen.getByRole('button', { name: 'Choose time' });
    await userEvent.click(button);
    const list = screen.getByRole('listbox', { name: 'Times' });
    await expect.poll(() => document.activeElement).toBe(list);
    // The list starts at the time, and the times are every 30 minutes.
    expect(document.getElementById(list.getAttribute('aria-activedescendant')!)!.textContent).toBe('9:30 AM');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(container.querySelector('output')!.textContent).toBe('10:00:00');
    expect(screen.queryByRole('listbox')).toBeNull();
    await expect.poll(() => document.activeElement).toBe(button);
    expect(input.value).toBe('10:00 AM');
  });

  it('beside a calendar with closeOnPick off, picks a date, then a time, and closes on the time', async () => {
    const { container } = render(<DateTime />);
    const output = () => container.querySelector('output')!.textContent;
    const input = screen.getByRole('textbox', { name: 'Start' }) as HTMLInputElement;
    const button = screen.getByRole('button', { name: 'Choose date and time' });
    await userEvent.click(button);
    screen.getByRole('dialog', { name: 'Choose date and time' });
    await expect.poll(() => document.activeElement?.textContent).toBe('7');
    // A new date keeps the time, and the picker stays open.
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(output()).toBe('2026-10-08T01:30:00');
    expect(screen.getByRole('dialog')).toBeTruthy();
    await userEvent.tab();
    const list = screen.getByRole('listbox', { name: 'Times' });
    expect(document.activeElement).toBe(list);
    expect(document.getElementById(list.getAttribute('aria-activedescendant')!)!.textContent).toBe('1:30 AM');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(output()).toBe('2026-10-08T02:00:00');
    expect(screen.queryByRole('dialog')).toBeNull();
    await expect.poll(() => document.activeElement).toBe(button);
    expect(input.value).toBe('10/8/2026, 2:00 AM');
  });
});
