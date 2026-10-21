/// <reference types="@vitest/browser/providers/playwright" />
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, ErrorMessage, Field, Form, Label, type NumberFormatOptions } from '../index.js';

afterEach(cleanup);

function Quantity({
  onSubmit,
  withForm = true,
  min,
  max,
  step,
  locale = 'en',
  required,
  initial = null,
  formatOptions,
}: {
  onSubmit?: (data: FormData) => void;
  withForm?: boolean;
  min?: number;
  max?: number;
  step?: number;
  locale?: string;
  required?: boolean;
  initial?: number | null;
  formatOptions?: NumberFormatOptions;
}) {
  const [value, setValue] = useState<number | null>(initial);
  const field = (
    <Field.Group>
      <Label.Root htmlFor="qty">Quantity</Label.Root>
      <Field.Root id="qty" name="quantity">
        <Field.Decrement />
        <Field.NumberInput
          value={value}
          onValueChange={setValue}
          min={min}
          max={max}
          step={step}
          locale={locale}
          required={required}
          formatOptions={formatOptions}
        />
        <Field.Increment />
      </Field.Root>
      {withForm ? <ErrorMessage.Root /> : null}
    </Field.Group>
  );
  const send = (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    onSubmit?.(new FormData(event.currentTarget));
  };
  return (
    <main data-appearance="light" data-density="comfortable">
      {withForm ? (
        <Form.Root onSubmit={send}>
          {field}
          <Button.Root type="submit">Send</Button.Root>
        </Form.Root>
      ) : (
        <form onSubmit={send}>
          {field}
          <button type="submit">Send</button>
        </form>
      )}
    </main>
  );
}

const input = () => screen.getByRole('spinbutton') as HTMLInputElement;
const valueOf = () => document.querySelector<HTMLInputElement>('[data-todae-value-input]')!.value;

describe('Field.NumberInput in a browser', () => {
  it.each([true, false])('commits on Enter before the form submits and reads its value (Form.Root: %s)', async (withForm) => {
    const onSubmit = vi.fn();
    render(<Quantity onSubmit={onSubmit} withForm={withForm} locale="de" />);
    await userEvent.click(input());
    await userEvent.keyboard('1234,5{Enter}');
    expect(onSubmit).toHaveBeenCalledOnce();
    // The same number whatever the locale: the text "1.234,5" never reaches the form.
    expect([...onSubmit.mock.calls[0]![0].entries()]).toEqual([['quantity', '1234.5']]);
    expect(input().value).toBe('1.234,5');
  });

  it('submits what is typed when the button is pressed, since the press blurs the input first', async () => {
    const onSubmit = vi.fn();
    render(<Quantity onSubmit={onSubmit} />);
    await userEvent.click(input());
    await userEvent.keyboard('77');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect([...onSubmit.mock.calls[0]![0].entries()]).toEqual([['quantity', '77']]);
  });

  it('blocks Enter on a required empty field, shows the message and keeps focus in the input', async () => {
    const onSubmit = vi.fn();
    render(<Quantity onSubmit={onSubmit} required />);
    await userEvent.click(input());
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    await screen.findByText('This field is required');
    await waitFor(() => expect(document.activeElement).toBe(input()));
  });

  it('steps with the arrows and the page keys, and snaps and clamps a typed number', async () => {
    render(<Quantity min={0} max={100} step={5} />);
    await userEvent.click(input());
    await userEvent.keyboard('{ArrowUp}');
    expect(input().value).toBe('0');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(input().value).toBe('10');
    await userEvent.keyboard('{ArrowDown}');
    expect(input().value).toBe('5');
    await userEvent.keyboard('{PageUp}');
    expect(input().value).toBe('55');
    await userEvent.keyboard('{Control>}a{/Control}37{Tab}');
    expect(input().value).toBe('35');
    expect(input().getAttribute('aria-valuenow')).toBe('35');
  });

  it('refuses a letter as it is typed', async () => {
    render(<Quantity locale="en" />);
    await userEvent.click(input());
    await userEvent.keyboard('1a2e,3.5');
    expect(input().value).toBe('12,3.5');
  });

  it('keeps the caret where it was when a keystroke is refused, and Home and End move it', async () => {
    render(<Quantity locale="en" />);
    await userEvent.click(input());
    await userEvent.keyboard('123{Home}a');
    expect(input().value).toBe('123');
    expect(input().selectionStart).toBe(0);
    await userEvent.keyboard('9{End}4');
    expect(input().value).toBe('91234');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}b');
    expect(input().selectionStart).toBe(3);
  });

  it('keeps a text the locale does not read, invalid, and blocks Enter instead of submitting the old number', async () => {
    for (const withForm of [true, false]) {
      cleanup();
      const onSubmit = vi.fn();
      render(<Quantity onSubmit={onSubmit} withForm={withForm} locale="de" />);
      await userEvent.click(input());
      await userEvent.keyboard('5{Tab}{Shift>}{Tab}{/Shift}');
      await userEvent.keyboard('{Control>}a{/Control}1.5{Enter}');
      expect(onSubmit, `Form.Root: ${withForm}`).not.toHaveBeenCalled();
      expect(input().value).toBe('1.5');
      expect(input().getAttribute('aria-invalid')).toBe('true');
      if (withForm) await screen.findByText('Enter a valid value');
      await userEvent.keyboard('{Control>}a{/Control}1,5{Enter}');
      expect(onSubmit).toHaveBeenCalledOnce();
      expect([...onSubmit.mock.calls[0]![0].entries()]).toEqual([['quantity', '1.5']]);
    }
  });

  it('lets an IME composition land, and flags the text on commit when it is no number', async () => {
    render(<Quantity locale="en" />);
    await userEvent.click(input());
    const session = cdp();
    await session.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 });
    expect(input().value).toBe('ㅎ');
    await session.send('Input.insertText', { text: 'ㅎ' });
    expect(input().value).toBe('ㅎ');
    await userEvent.keyboard('{Tab}');
    expect(input().value).toBe('ㅎ');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    await userEvent.click(input());
    await userEvent.keyboard('{Control>}a{/Control}');
    await session.send('Input.imeSetComposition', { text: '5', selectionStart: 1, selectionEnd: 1 });
    expect(input().value).toBe('5');
    await session.send('Input.insertText', { text: '5' });
    expect(input().value).toBe('5');
    await userEvent.keyboard('{Tab}');
    expect(valueOf()).toBe('5');
    expect(input().getAttribute('aria-invalid')).toBeNull();
  });

  it('lets a person delete through a unit or a currency name, one key at a time', async () => {
    const formats = [
      { text: '5 kilometers', formatOptions: { style: 'unit', unit: 'kilometer', unitDisplay: 'long' } },
      { text: '5.00 US dollars', formatOptions: { style: 'currency', currency: 'USD', currencyDisplay: 'name' } },
    ] as const;
    for (const { text, formatOptions } of formats) {
      cleanup();
      render(<Quantity locale="en" initial={5} formatOptions={formatOptions} />);
      expect(input().value).toBe(text);
      await userEvent.click(input());
      await userEvent.keyboard('{End}');
      for (let at = text.length - 1; at >= 0; at--) {
        await userEvent.keyboard('{Backspace}');
        expect(input().value).toBe(text.slice(0, at));
      }
    }
  });

  it('does not step on the wheel', async () => {
    render(<Quantity />);
    await userEvent.click(input());
    input().dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    expect(input().value).toBe('');
  });

  it('steps from a button press while focus stays in the input, and the buttons are not tab stops', async () => {
    render(<Quantity min={1} max={3} />);
    const more = screen.getByRole('button', { name: /^Increase/ });
    const less = screen.getByRole('button', { name: /^Decrease/ });
    await userEvent.click(input());
    await userEvent.click(more);
    expect(input().value).toBe('1');
    expect(document.activeElement).toBe(input());
    await userEvent.click(more);
    await userEvent.click(more);
    expect(input().value).toBe('3');
    expect((more as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(less);
    expect(input().value).toBe('2');
    expect(document.activeElement).toBe(input());
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Send' }));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(input());
    await userEvent.tab({ shift: true });
    expect(document.activeElement).not.toBe(less);
  });

  it('does not take focus from a press on a step button when the input has none', async () => {
    render(<Quantity min={1} max={3} />);
    await userEvent.click(screen.getByRole('button', { name: /^Increase/ }));
    expect(input().value).toBe('1');
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: /^Increase/ }));
  });

  it('repeats while a button is held, and stops when it is let go', async () => {
    render(<Quantity min={0} max={1000} />);
    const more = screen.getByRole('button', { name: /^Increase/ });
    const box = more.getBoundingClientRect();
    const point = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, button: 0, pointerId: 1, bubbles: true };
    more.dispatchEvent(new PointerEvent('pointerdown', point));
    await waitFor(() => expect(Number(input().value)).toBeGreaterThan(3), { timeout: 3000 });
    more.dispatchEvent(new PointerEvent('pointerup', point));
    const stopped = input().value;
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(input().value).toBe(stopped);
  });

  it('passes axe', async () => {
    render(<Quantity required />);
    const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
});
