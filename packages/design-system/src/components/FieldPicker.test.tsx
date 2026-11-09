import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Calendar, ColorPicker, Field, GlyphsProvider, OptionList, timeOptions } from '../index.js';

afterEach(cleanup);

const date = (text: string) => Temporal.PlainDate.from(text);

function DateField({ onOpenChange }: { onOpenChange?: (open: boolean, reason: string) => void }) {
  const [value, setValue] = useState<Temporal.PlainDate | null>(date('2026-10-13'));
  return (
    <Field.Root aria-label="Day">
      <Field.DateInput value={value} onValueChange={setValue} locale="en-US" />
      <Field.Picker onOpenChange={onOpenChange}>
        <Calendar.Root value={value} onValueChange={setValue} locale="en-US">
          <Calendar.Header />
          <Calendar.Grid />
        </Calendar.Root>
      </Field.Picker>
    </Field.Root>
  );
}

const button = (name: string) => screen.getByRole('button', { name });
const open = async (name: string) => {
  await act(async () => {
    fireEvent.click(button(name));
  });
};

describe('Field.Picker', () => {
  it('beside a Field.DateInput is a calendar button named from the strings, and the input keeps the field', async () => {
    render(<DateField />);
    const input = screen.getByRole('textbox', { name: 'Day' });
    const picker = button('Choose date');
    expect(picker.hasAttribute('id')).toBe(false);
    expect(picker.getAttribute('aria-haspopup')).toBe('dialog');
    expect(picker.getAttribute('aria-expanded')).toBe('false');
    expect(input.id).not.toBe('');
    await open('Choose date');
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeTruthy();
    expect(picker.getAttribute('aria-controls')).toBe(screen.getByRole('dialog').id);
  });

  it('closes on the pick that makes the value, with the select reason, and the input shows the date', async () => {
    const onOpenChange = vi.fn();
    render(<DateField onOpenChange={onOpenChange} />);
    await open('Choose date');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /October 14, 2026/ }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'select');
    expect((screen.getByRole('textbox', { name: 'Day' }) as HTMLInputElement).value).toBe('10/14/2026');
  });

  it('closes on Escape and gives focus back to its button', async () => {
    render(<DateField />);
    button('Choose date').focus();
    await open('Choose date');
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button('Choose date'));
  });

  it('opens on a press on a read-only typed input beside it', async () => {
    render(
      <Field.Root aria-label="Day">
        <Field.DateInput value={date('2026-10-13')} locale="en-US" />
        <Field.Picker>
          <Calendar.Root value={date('2026-10-13')} onValueChange={() => undefined} locale="en-US">
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </Field.Picker>
      </Field.Root>,
    );
    const input = screen.getByRole('textbox', { name: 'Day' });
    await act(async () => {
      fireEvent.mouseDown(input, { button: 0 });
      fireEvent.click(input, { detail: 1 });
    });
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeTruthy();
  });

  it('closes on an OptionList pick beside a Field.TimeInput, and is named and drawn for a time', async () => {
    function TimeField() {
      const [time, setTime] = useState<Temporal.PlainTime | null>(null);
      return (
        <Field.Root aria-label="Start">
          <Field.TimeInput value={time} onValueChange={setTime} locale="en-US" />
          <Field.Picker>
            <OptionList.Root
              aria-label="Times"
              value={time?.toString() ?? null}
              onValueChange={(next) => setTime(Temporal.PlainTime.from(next))}
            >
              {timeOptions({ step: 60, locale: 'en-US' }).map((option) => (
                <OptionList.Option key={option.value} value={option.value}>
                  {option.label}
                </OptionList.Option>
              ))}
            </OptionList.Root>
          </Field.Picker>
        </Field.Root>
      );
    }
    render(
      <GlyphsProvider glyphs={{ clock: <span data-testid="clock" /> }}>
        <TimeField />
      </GlyphsProvider>,
    );
    expect(screen.getByTestId('clock')).toBeTruthy();
    await open('Choose time');
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: '9:00 AM' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Start' }) as HTMLInputElement).value).toBe('9:00 AM');
  });

  it('with closeOnPick off stays open on a pick, and closes on the close its function child gets', async () => {
    const onOpenChange = vi.fn();
    render(
      <Field.Root aria-label="Day">
        <Field.DateInput value={null} onValueChange={() => undefined} locale="en-US" />
        <Field.Picker closeOnPick={false} onOpenChange={onOpenChange}>
          {({ close }) => (
            <>
              <Calendar.Root value={null} onValueChange={() => undefined} locale="en-US">
                <Calendar.Header />
                <Calendar.Grid />
              </Calendar.Root>
              <button type="button" onClick={close}>
                Done
              </button>
            </>
          )}
        </Field.Picker>
      </Field.Root>,
    );
    await open('Choose date');
    const cell = screen.getAllByRole('button').find((node) => node.hasAttribute('data-todae-calendar-cell'))!;
    await act(async () => {
      fireEvent.click(cell);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'select');
  });

  it('with swatch is filled with the color, named colorPicker beside a text input, and stays open on a change', async () => {
    function Accent() {
      const [hex, setHex] = useState('#3366ff');
      return (
        <Field.Root aria-label="Accent">
          <Field.TextInput value={hex} onChange={(event) => setHex(event.target.value)} />
          <Field.Picker swatch={hex}>
            <ColorPicker.Root value={hex} onValueChange={setHex}>
              <ColorPicker.Hue />
            </ColorPicker.Root>
          </Field.Picker>
        </Field.Root>
      );
    }
    render(<Accent />);
    expect(button('Color picker').style.getPropertyValue('--_swatch')).toBe('#3366ff');
    await open('Color picker');
    await act(async () => {
      fireEvent.change(screen.getByRole('slider', { name: 'Hue' }), { target: { value: '120' } });
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(button('Color picker').style.getPropertyValue('--_swatch')).not.toBe('#3366ff');
  });

  it('beside a plain text input is named picker with a chevron, and takes its own label and glyph', () => {
    render(
      <>
        <Field.Root aria-label="One">
          <Field.TextInput value="" onChange={() => undefined} />
          <Field.Picker />
        </Field.Root>
        <Field.Root aria-label="Two">
          <Field.DateRangeInput value={null} onValueChange={() => undefined} />
          <Field.Picker />
        </Field.Root>
        <Field.Root aria-label="Three">
          <Field.TextInput value="" onChange={() => undefined} />
          <Field.Picker label="Pick a plan" glyph={<span data-testid="mine" />} />
        </Field.Root>
      </>,
    );
    expect(button('Open picker')).toBeTruthy();
    expect(button('Choose dates')).toBeTruthy();
    expect(button('Pick a plan')).toBeTruthy();
    expect(screen.getByTestId('mine')).toBeTruthy();
  });

  it("alone is the field's control, named by the field", () => {
    render(
      <Field.Root id="plan" aria-label="Plan">
        <Field.Picker />
      </Field.Root>,
    );
    expect(button('Plan').id).toBe('plan');
  });
});
