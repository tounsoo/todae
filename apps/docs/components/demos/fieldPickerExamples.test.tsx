// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import FieldDateInputPicker from '../../examples/field/date-input/FieldDateInputPicker';
import FieldDateRangeInputPicker from '../../examples/field/date-range-input/FieldDateRangeInputPicker';
import FieldPickerPickOnly from '../../examples/field/picker/FieldPickerPickOnly';
import FieldTimeInputPicker from '../../examples/field/time-input/FieldTimeInputPicker';
import DateRangePresets from '../../examples/recipes/date-range-presets/DateRangePresets';
import DateTimePicker from '../../examples/recipes/date-time-picker/DateTimePicker';

afterEach(cleanup);

// Each docs example and recipe with a Field.Picker: a pick in its panel sets the value the field
// sends, and the pick that makes the value whole closes the picker.

const sent = () => document.querySelector<HTMLInputElement>('[data-todae-value-input]')!.value;
const dialog = () => screen.queryByRole('dialog');
const press = (element: Element) => act(() => void fireEvent.click(element));
const day = (date: Temporal.PlainDate) =>
  screen.getByRole('button', { name: date.toLocaleString('en-US', { dateStyle: 'full', calendar: 'gregory' }) });
const open = () => press(screen.getAllByRole('button').find((button) => button.hasAttribute('aria-haspopup'))!);

// Days in the month the calendar opens on, with no value.
const today = Temporal.Now.plainDateISO();
const first = today.with({ day: 10 });
const second = today.with({ day: 14 });

const dates: [string, ComponentType<{ locale: string }>][] = [
  ['Field.DateInput with a picker', FieldDateInputPicker],
  ['the read-only date input with a picker', FieldPickerPickOnly],
];

describe('a pick in a Field.Picker example', () => {
  it.each(dates)('%s: a day sets the date and closes the picker', async (_, Example) => {
    render(<Example locale="en-US" />);
    await open();
    await press(day(first));
    expect(sent()).toBe(first.toString());
    expect(dialog()).toBeNull();
  });

  it.each([
    ['Field.DateRangeInput with a picker', FieldDateRangeInputPicker],
    ['the date range presets recipe', DateRangePresets],
  ] as const)('%s: two days set the range and close the picker', async (_, Example) => {
    render(<Example locale="en-US" />);
    await open();
    await press(day(first));
    expect(dialog()).not.toBeNull();
    await press(day(second));
    expect(sent()).toBe(`${first}/${second}`);
    expect(dialog()).toBeNull();
  });

  it('Field.TimeInput with a picker: a time sets the time and closes the picker', async () => {
    render(<FieldTimeInputPicker locale="en-US" />);
    await open();
    await press(screen.getByRole('option', { name: '9:00 AM' }));
    expect(sent()).toBe('09:00');
    expect(dialog()).toBeNull();
  });

  it('the date and time recipe: a day and a time set the value and close the picker, in either order', async () => {
    render(<DateTimePicker locale="en-US" />);
    await open();
    await press(day(first));
    // Half a value: the picker stays open for the time.
    expect(sent()).toBe('');
    expect(dialog()).not.toBeNull();
    await press(screen.getByRole('option', { name: '9:00 AM' }));
    expect(sent()).toBe(`${first}T09:00`);
    expect(dialog()).toBeNull();

    // With a value, a day alone changes the day and closes the picker.
    await open();
    await press(day(second));
    expect(sent()).toBe(`${second}T09:00`);
    expect(dialog()).toBeNull();

    // And a time alone changes the time.
    await open();
    await press(screen.getByRole('option', { name: '10:30 AM' }));
    expect(sent()).toBe(`${second}T10:30`);
    expect(dialog()).toBeNull();
  });
});
