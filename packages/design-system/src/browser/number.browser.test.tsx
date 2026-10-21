/// <reference types="@vitest/browser/providers/playwright" />
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { useEffect, useRef, useState } from 'react';
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

  it.each([true, false])('submits a readable text with no blur or Enter, as requestSubmit does (Form.Root: %s)', async (withForm) => {
    const onSubmit = vi.fn();
    render(<Quantity onSubmit={onSubmit} withForm={withForm} initial={3} />);
    await userEvent.click(input());
    await userEvent.keyboard('{Control>}a{/Control}9');
    input().form!.requestSubmit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect([...onSubmit.mock.calls[0]![0].entries()]).toEqual([['quantity', '9']]);
  });

  it('does not send a cleared required text from a native form, and sends the number the product accepted', async () => {
    const onSubmit = vi.fn();
    const { unmount } = render(<Quantity onSubmit={onSubmit} withForm={false} initial={7} required />);
    await userEvent.click(input());
    await userEvent.keyboard('{Control>}a{/Control}{Backspace}');
    input().form!.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSubmit).not.toHaveBeenCalled();
    unmount();

    // A product that refuses the number: the form reads what is shown.
    const sent = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          sent(new FormData(event.currentTarget).get('quantity'));
        }}
      >
        <Field.Root aria-label="Quantity" name="quantity">
          <Field.NumberInput value={50} max={100} locale="en" onValueChange={() => undefined} />
        </Field.Root>
      </form>,
    );
    await userEvent.click(input());
    await userEvent.keyboard('{Control>}a{/Control}70');
    input().form!.requestSubmit();
    await waitFor(() => expect(sent).toHaveBeenCalledWith('50'));
    expect(input().value).toBe('50');
  });

  it('does not commit the text when product code checks the form while the person types', async () => {
    const onChange = vi.fn();
    function Checked() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <form onKeyUp={(event) => event.currentTarget.checkValidity()}>
          <Field.Root aria-label="Quantity" name="quantity">
            <Field.NumberInput
              value={value}
              required
              min={10}
              locale="en"
              onValueChange={(next) => {
                onChange(next);
                setValue(next);
              }}
            />
          </Field.Root>
        </form>
      );
    }
    render(<Checked />);
    await userEvent.click(input());
    await userEvent.keyboard('5');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard('0');
    expect(input().value).toBe('50');
  });

  it('drops an unreadable text on a form reset, but keeps it when a handler cancels the reset', async () => {
    function Resettable({ cancel }: { cancel: boolean }) {
      const [value, setValue] = useState<number | null>(3);
      return (
        <form onReset={(event) => cancel && event.preventDefault()}>
          <Field.Root aria-label="Quantity" name="quantity">
            <Field.NumberInput value={value} onValueChange={setValue} locale="en" />
          </Field.Root>
          <button type="reset">Reset</button>
        </form>
      );
    }
    const { rerender } = render(<Resettable cancel />);
    await userEvent.click(input());
    await userEvent.keyboard('{Control>}a{/Control}1,5');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(input().value).toBe('1,5');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    rerender(<Resettable cancel={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(input().value).toBe('3'));
    expect(input().getAttribute('aria-invalid')).toBeNull();
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

// A submit waits for the commit and is sent again after the render that shows it, so each of these is one commit and one send, whatever phase the submit started in. A browser differs from jsdom here: it ignores a requestSubmit made while a submit event is being fired.
describe('Field.NumberInput and a submit that waits for the commit, in a browser', () => {
  type Sent = (string | null)[];
  function Page({
    sent,
    told,
    mode = 'plain',
    initial = 3,
    required,
    validate = false,
  }: {
    sent: Sent;
    told: (number | null)[];
    mode?: 'plain' | 'auto' | 'effect' | 'formRoot';
    initial?: number | null;
    required?: boolean;
    validate?: boolean;
  }) {
    const [value, setValue] = useState<number | null>(initial);
    const [go, setGo] = useState(0);
    const form = useRef<HTMLFormElement>(null);
    useEffect(() => {
      if (go) form.current?.requestSubmit();
    }, [go]);
    const field = (
      <Field.Group>
        <Label.Root htmlFor="qty">Quantity</Label.Root>
        <Field.Root id="qty" name="quantity">
          <Field.NumberInput
            value={value}
            required={required}
            locale="en"
            onKeyUp={mode === 'effect' ? (event) => event.key === 'F2' && setGo((n) => n + 1) : undefined}
            onValueChange={(next) => {
              told.push(next);
              setValue(next);
              if (mode === 'auto') form.current?.requestSubmit();
            }}
          />
        </Field.Root>
        {mode === 'formRoot' ? <ErrorMessage.Root /> : null}
      </Field.Group>
    );
    const onSubmit = (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
      event.preventDefault();
      sent.push(new FormData(event.currentTarget).get('quantity') as string | null);
    };
    return mode === 'formRoot' ? (
      <Form.Root ref={form} onSubmit={onSubmit}>
        {field}
        <Button.Root type="submit">Send</Button.Root>
      </Form.Root>
    ) : (
      <form ref={form} noValidate={!validate} onSubmit={onSubmit}>
        {field}
        <button type="submit">Send</button>
        <button type="submit" formNoValidate>
          Send anyway
        </button>
      </form>
    );
  }
  const replace = (text: string) => userEvent.keyboard(`{Control>}a{/Control}${text}`);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

  it('Enter: one commit, one send', async () => {
    const sent: Sent = [];
    const told: (number | null)[] = [];
    render(<Page sent={sent} told={told} />);
    await userEvent.click(input());
    await replace('7');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(sent).toEqual(['7']);
    expect(told).toEqual([7]);
  });

  it('a press on the submit button: one commit, one send', async () => {
    const sent: Sent = [];
    const told: (number | null)[] = [];
    render(<Page sent={sent} told={told} />);
    await userEvent.click(input());
    await replace('7');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await settle();
    expect(sent).toEqual(['7']);
    expect(told).toEqual([7]);
  });

  it('requestSubmit with focus in the text: one commit, one send', async () => {
    const sent: Sent = [];
    const told: (number | null)[] = [];
    render(<Page sent={sent} told={told} />);
    await userEvent.click(input());
    await replace('7');
    input().form!.requestSubmit();
    await settle();
    expect(sent).toEqual(['7']);
    expect(told).toEqual([7]);
    expect(input().value).toBe('7');
  });

  it('a requestSubmit from an effect sends the accepted number, with no React warning', async () => {
    const error = vi.spyOn(console, 'error');
    const sent: Sent = [];
    const told: (number | null)[] = [];
    render(<Page sent={sent} told={told} mode="effect" />);
    await userEvent.click(input());
    await replace('7');
    await userEvent.keyboard('{F2}');
    await settle();
    expect(sent).toEqual(['7']);
    expect(told).toEqual([7]);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('a product that submits from onValueChange: one commit, one send, with the new number', async () => {
    const sent: Sent = [];
    const told: (number | null)[] = [];
    render(<Page sent={sent} told={told} mode="auto" />);
    await userEvent.click(input());
    await replace('7');
    await userEvent.keyboard('{ArrowUp}');
    await settle();
    expect(told).toEqual([8]);
    expect(sent).toEqual(['8']);
  });

  it('a native validating form: a cleared required text is not sent, and a submitter that turns validation off sends it', async () => {
    const sent: Sent = [];
    const told: (number | null)[] = [];
    render(<Page sent={sent} told={told} initial={7} required validate />);
    await userEvent.click(input());
    await userEvent.keyboard('{Control>}a{/Control}{Backspace}');
    input().form!.requestSubmit();
    await settle();
    expect(sent).toEqual([]);
    expect(told).toEqual([null]);
    // The same cleared text, with the submitter that turns validation off.
    input().form!.requestSubmit(screen.getByRole('button', { name: 'Send anyway' }));
    await settle();
    expect(sent).toEqual(['']);
  });

  it('documented limit: a native check runs before submit fires, so a requestSubmit with a stale invalid number is blocked, and what moved focus committed the text', async () => {
    const sent: Sent = [];
    const told: (number | null)[] = [];
    render(<Page sent={sent} told={told} initial={null} required validate />);
    await userEvent.click(input());
    await replace('7');
    input().form!.requestSubmit();
    await settle();
    expect(sent).toEqual([]);
    // The browser focused the invalid value input, which gives focus back to the text and so blurred it: that commit is the only one.
    expect(told).toEqual([7]);
    // Commit first, by blur or Enter, before a programmatic submit.
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(sent).toEqual(['7']);
  });

  it('Form.Root: a typed number is sent once, and a cleared required one is not', async () => {
    const sent: Sent = [];
    const told: (number | null)[] = [];
    render(<Page sent={sent} told={told} mode="formRoot" required />);
    await userEvent.click(input());
    await replace('7');
    input().form!.requestSubmit();
    await settle();
    expect(sent).toEqual(['7']);
    expect(told).toEqual([7]);
    await userEvent.keyboard('{Control>}a{/Control}{Backspace}');
    input().form!.requestSubmit();
    await settle();
    expect(sent).toEqual(['7']);
    expect(told).toEqual([7, null]);
  });
});
