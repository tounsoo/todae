import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorMessage, Field, Form, GlyphsProvider, Label, StringsProvider } from '../index.js';
import { mount, submit } from '../test/form.js';
import { resetWarnOnce } from './warnOnce.js';

// Each tick of a held press is its own task, as in a browser, so each renders before the next.
function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  cleanup();
  resetWarnOnce();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type NumberProps = Partial<ComponentProps<typeof Field.NumberInput>>;

/** A controlled number input, which reports each commit to `onCommit`. */
function Quantity({
  initial = null,
  onCommit,
  buttons,
  ...props
}: NumberProps & { initial?: number | null; onCommit?: (value: number | null) => void; buttons?: boolean }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <Field.Root aria-label="Quantity" name="quantity">
      {buttons ? <Field.Decrement /> : null}
      <Field.NumberInput
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onCommit?.(next);
        }}
        {...props}
      />
      {buttons ? <Field.Increment /> : null}
    </Field.Root>
  );
}

const input = () => screen.getByRole('spinbutton') as HTMLInputElement;
const valueInput = () => document.querySelector<HTMLInputElement>('[data-todae-value-input]')!;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const key = (name: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(input(), { key: name, ...init });

describe('Field.NumberInput', () => {
  it('is a text input with the spinbutton role and its value in the aria attributes', () => {
    render(<Quantity initial={1234.5} min={0} max={5000} step={0.5} locale="de" />);
    expect(input().type).toBe('text');
    expect(input().getAttribute('inputmode')).toBe('decimal');
    expect(input().value).toBe('1.234,5');
    expect(input().getAttribute('aria-valuenow')).toBe('1234.5');
    expect(input().getAttribute('aria-valuemin')).toBe('0');
    expect(input().getAttribute('aria-valuemax')).toBe('5000');
    expect(input().getAttribute('aria-valuetext')).toBe('1.234,5');
    expect(input().getAttribute('aria-label')).toBe('Quantity');
  });

  it('leaves the aria value off when there is no number or no bound, and marks a required one', () => {
    render(<Quantity required />);
    expect(input().hasAttribute('aria-valuenow')).toBe(false);
    expect(input().hasAttribute('aria-valuetext')).toBe(false);
    expect(input().hasAttribute('aria-valuemin')).toBe(false);
    expect(input().getAttribute('aria-required')).toBe('true');
    expect(input().required).toBe(false);
  });

  it('shows a numeric keypad for whole numbers, and any inputMode the product sets', () => {
    const { rerender } = render(<Quantity step={1} min={0} />);
    expect(input().getAttribute('inputmode')).toBe('numeric');
    rerender(<Quantity step={1} min={0} inputMode="text" />);
    expect(input().getAttribute('inputmode')).toBe('text');
    rerender(<Quantity step={1} min={0.5} />);
    expect(input().getAttribute('inputmode')).toBe('decimal');
  });

  it('writes the number in the locale and the format options', () => {
    render(
      <Quantity initial={0.125} locale="de" formatOptions={{ style: 'percent', maximumFractionDigits: 1 }} />,
    );
    expect(input().value).toBe('12,5\u00a0%');
    expect(input().getAttribute('aria-valuetext')).toBe('12,5\u00a0%');
  });

  it('commits what is typed on blur, parsed in the locale, and not while typing', () => {
    const onCommit = vi.fn();
    render(<Quantity locale="de" onCommit={onCommit} />);
    type('1.234,5');
    expect(input().value).toBe('1.234,5');
    type('1.234,56');
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith(1234.56);
    expect(input().value).toBe('1.234,56');
    expect(valueInput().value).toBe('1234.56');
  });

  it('rewrites the text as the locale writes it, and clamps and snaps the commit', () => {
    const onCommit = vi.fn();
    render(<Quantity locale="en" min={0} max={100} step={5} onCommit={onCommit} />);
    type('1234');
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(100);
    expect(input().value).toBe('100');
    type('-8');
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(0);
    type('42');
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(40);
    expect(input().value).toBe('40');
  });

  it('shows the typed text as it is, even where the number is the same', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={1234.5} locale="en" onCommit={onCommit} />);
    type('1234.50');
    expect(input().value).toBe('1234.50');
    fireEvent.blur(input());
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('1,234.5');
  });

  it('refuses a keystroke that could not become a number, and keeps the last text', () => {
    render(<Quantity locale="en" initial={12} />);
    type('12e');
    expect(input().value).toBe('12');
    type('12.');
    expect(input().value).toBe('12.');
    type('12.5.');
    expect(input().value).toBe('12.');
    type('-');
    expect(input().value).toBe('-');
  });

  it('commits an empty text as null', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={3} onCommit={onCommit} />);
    type('');
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenCalledWith(null);
    expect(input().value).toBe('');
    expect(input().hasAttribute('aria-valuenow')).toBe(false);
  });

  it('goes back to the value when the text means no number, and reports nothing', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={3} locale="en" onCommit={onCommit} />);
    type('-');
    fireEvent.blur(input());
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('3');
    type('1,2');
    fireEvent.blur(input());
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('3');
  });

  it('commits on Enter, and leaves the event alone so the form goes on to submit', () => {
    const onCommit = vi.fn();
    render(<Quantity locale="en" onCommit={onCommit} />);
    type('7');
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    fireEvent(input(), enter);
    expect(onCommit).toHaveBeenCalledWith(7);
    expect(enter.defaultPrevented).toBe(false);
  });

  it('leaves an Enter that ends an IME composition to the input', () => {
    const onCommit = vi.fn();
    render(<Quantity locale="en" onCommit={onCommit} />);
    type('7');
    key('Enter', { isComposing: true });
    key('Enter', { keyCode: 229 });
    expect(onCommit).not.toHaveBeenCalled();
    key('Enter');
    expect(onCommit).toHaveBeenCalledWith(7);
  });

  it('waits for the end of a composition to refuse its text', () => {
    render(<Quantity locale="en" initial={5} />);
    fireEvent.compositionStart(input());
    type('5ㅎ');
    expect(input().value).toBe('5ㅎ');
    fireEvent.compositionEnd(input());
    expect(input().value).toBe('5');
    fireEvent.compositionStart(input());
    type('52');
    fireEvent.compositionEnd(input());
    expect(input().value).toBe('52');
  });

  it('does not report a blur with no edit, and does not clamp a value the product set', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={150} max={100} onCommit={onCommit} />);
    fireEvent.focus(input());
    fireEvent.blur(input());
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('150');
  });

  it('shows a value the product sets while the person is typing, instead of the draft', () => {
    const { rerender } = render(<Field.Root aria-label="Quantity"><Field.NumberInput value={1} onValueChange={() => undefined} locale="en" /></Field.Root>);
    type('12');
    expect(input().value).toBe('12');
    rerender(<Field.Root aria-label="Quantity"><Field.NumberInput value={9} onValueChange={() => undefined} locale="en" /></Field.Root>);
    expect(input().value).toBe('9');
    rerender(<Field.Root aria-label="Quantity"><Field.NumberInput value={1} onValueChange={() => undefined} locale="en" /></Field.Root>);
    expect(input().value).toBe('1');
  });

  it('shows the product value again when it does not take a commit', () => {
    render(
      <Field.Root aria-label="Quantity">
        <Field.NumberInput value={4} onValueChange={() => undefined} locale="en" />
      </Field.Root>,
    );
    type('8');
    fireEvent.blur(input());
    expect(input().value).toBe('4');
  });

  it('is read-only without onValueChange, and does not step', () => {
    render(
      <Field.Root aria-label="Quantity">
        <Field.Decrement />
        <Field.NumberInput value={4} />
        <Field.Increment />
      </Field.Root>,
    );
    expect(input().readOnly).toBe(true);
    key('ArrowUp');
    expect(input().value).toBe('4');
    expect((screen.getByRole('button', { name: 'Increase' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Decrease' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('is disabled with its field, and takes readOnly from the product', () => {
    const { rerender } = render(
      <Field.Root aria-label="Quantity" disabled>
        <Field.Increment />
        <Field.NumberInput value={4} onValueChange={() => undefined} />
      </Field.Root>,
    );
    expect(input().disabled).toBe(true);
    expect(valueInput().disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Increase' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <Field.Root aria-label="Quantity">
        <Field.Increment />
        <Field.NumberInput value={4} onValueChange={() => undefined} readOnly />
      </Field.Root>,
    );
    expect(input().readOnly).toBe(true);
    expect(input().disabled).toBe(false);
  });

  it('calls the product handlers before its own', () => {
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
    const onBlur = vi.fn();
    const onCommit = vi.fn();
    render(<Quantity initial={2} onKeyDown={onKeyDown} onBlur={onBlur} onCommit={onCommit} />);
    key('ArrowUp');
    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
    type('5');
    fireEvent.blur(input());
    expect(onBlur).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith(5);
  });
});

describe('Field.NumberInput keys', () => {
  it('steps with the arrows from the value, and from the typed text', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={5} min={1} max={9} onCommit={onCommit} />);
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(6);
    expect(input().value).toBe('6');
    key('ArrowDown');
    key('ArrowDown');
    expect(onCommit).toHaveBeenLastCalledWith(4);
    type('8');
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(9);
    key('ArrowUp');
    expect(onCommit).toHaveBeenCalledTimes(4);
  });

  it('steps by the step, snapped, and by largeStep or ten steps with the page keys', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={0} step={0.1} onCommit={onCommit} />);
    key('ArrowUp');
    key('ArrowUp');
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(0.3);
    key('PageUp');
    expect(onCommit).toHaveBeenLastCalledWith(1.3);
    key('PageDown');
    key('PageDown');
    expect(onCommit).toHaveBeenLastCalledWith(-0.7);
  });

  it('steps by largeStep on the page keys', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={50} step={1} largeStep={25} onCommit={onCommit} />);
    key('PageUp');
    expect(onCommit).toHaveBeenLastCalledWith(75);
  });

  it('starts from no value at min, or at the step', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<Quantity min={3} onCommit={onCommit} />);
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(3);
    unmount();
    render(<Quantity step={5} onCommit={onCommit} />);
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(5);
  });

  it('goes to min and max with Home and End when set, and leaves the caret keys otherwise', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<Quantity initial={5} min={1} max={9} onCommit={onCommit} />);
    const home = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    fireEvent(input(), home);
    expect(home.defaultPrevented).toBe(true);
    expect(onCommit).toHaveBeenLastCalledWith(1);
    key('End');
    expect(onCommit).toHaveBeenLastCalledWith(9);
    unmount();
    onCommit.mockClear();
    render(<Quantity initial={5} onCommit={onCommit} />);
    const open = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    fireEvent(input(), open);
    expect(open.defaultPrevented).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('ends at the highest number on the step when max is off it', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={3} min={0} max={10} step={3} onCommit={onCommit} />);
    key('End');
    expect(onCommit).toHaveBeenLastCalledWith(9);
  });

  it('leaves a key with a modifier to the browser', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={5} min={1} max={9} onCommit={onCommit} />);
    for (const init of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      key('ArrowUp', init);
      key('Home', init);
    }
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not step on the wheel', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={5} onCommit={onCommit} />);
    input().focus();
    fireEvent.wheel(input(), { deltaY: -100 });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('steps the same way in a right-to-left page, in a locale with its own digits', () => {
    const onCommit = vi.fn();
    render(
      <div dir="rtl">
        <Quantity initial={1234.5} locale="ar-EG" onCommit={onCommit} />
      </div>,
    );
    expect(input().value).toBe('١٬٢٣٤٫٥');
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(1235.5);
    expect(input().value).toBe('١٬٢٣٥٫٥');
    type('٧٫٥');
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(7.5);
    expect(valueInput().value).toBe('7.5');
  });
});

describe('Field.Increment and Field.Decrement', () => {
  const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

  it('are named from the strings, drawn with the glyphs, and not tab stops', () => {
    render(<Quantity initial={5} buttons />);
    for (const name of ['Increase', 'Decrease']) {
      expect(button(name).tabIndex).toBe(-1);
      expect(button(name).type).toBe('button');
      expect(button(name).getAttribute('aria-controls')).toBe(input().id);
      expect(button(name).querySelector('svg')).not.toBeNull();
    }
  });

  it('follow StringsProvider and GlyphsProvider, and content replaces the glyph', () => {
    render(
      <StringsProvider strings={{ increment: 'Augmenter', decrement: 'Diminuer' }}>
        <GlyphsProvider glyphs={{ plus: <svg data-testid="plus" />, minus: <svg data-testid="minus" /> }}>
          <Quantity initial={5} buttons />
        </GlyphsProvider>
      </StringsProvider>,
    );
    expect(button('Augmenter').querySelector('[data-testid="plus"]')).not.toBeNull();
    expect(button('Diminuer').querySelector('[data-testid="minus"]')).not.toBeNull();
    cleanup();
    render(
      <Field.Root aria-label="Quantity">
        <Field.NumberInput value={5} onValueChange={() => undefined} />
        <Field.Increment>Add one</Field.Increment>
        <Field.Decrement aria-label="One less">
          <span aria-hidden="true">-</span>
        </Field.Decrement>
      </Field.Root>,
    );
    expect(button('Add one').querySelector('svg')).toBeNull();
    expect(button('One less')).toBeTruthy();
  });

  it('step the number once on a press, and keep focus in the input', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={5} buttons onCommit={onCommit} />);
    input().focus();
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
    fireEvent(button('Increase'), down);
    expect(down.defaultPrevented).toBe(true);
    fireEvent.pointerDown(button('Increase'), { button: 0 });
    fireEvent.pointerUp(button('Increase'));
    fireEvent.click(button('Increase'), { detail: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith(6);
    expect(document.activeElement).toBe(input());
    fireEvent.pointerDown(button('Decrease'), { button: 0 });
    fireEvent.pointerUp(button('Decrease'));
    expect(onCommit).toHaveBeenLastCalledWith(5);
  });

  it('step once on a click with no press, from a key or assistive technology', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={5} buttons onCommit={onCommit} />);
    fireEvent.click(button('Increase'), { detail: 0 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith(6);
  });

  it('step from the text being typed, snapped', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={5} step={5} buttons onCommit={onCommit} />);
    type('12');
    fireEvent.click(button('Increase'), { detail: 0 });
    expect(onCommit).toHaveBeenLastCalledWith(15);
  });

  it('are disabled at the bounds, and enabled again when the number moves', () => {
    render(<Quantity initial={1} min={1} max={2} buttons />);
    expect(button('Decrease').disabled).toBe(true);
    expect(button('Increase').disabled).toBe(false);
    fireEvent.click(button('Increase'), { detail: 0 });
    expect(button('Decrease').disabled).toBe(false);
    expect(button('Increase').disabled).toBe(true);
  });

  it('are enabled with no number, even with bounds', () => {
    render(<Quantity min={1} max={2} buttons />);
    expect(button('Decrease').disabled).toBe(false);
    expect(button('Increase').disabled).toBe(false);
  });

  describe('held', () => {
    it('repeat after the delay, every interval, until the press ends', () => {
      vi.useFakeTimers();
      const onCommit = vi.fn();
      render(<Quantity initial={0} buttons onCommit={onCommit} />);
      fireEvent.pointerDown(button('Increase'), { button: 0 });
      expect(onCommit).toHaveBeenCalledTimes(1);
      tick(399);
      expect(onCommit).toHaveBeenCalledTimes(1);
      tick(1);
      for (let repeat = 0; repeat < 3; repeat++) tick(60);
      expect(onCommit).toHaveBeenCalledTimes(1 + 3);
      expect(onCommit).toHaveBeenLastCalledWith(4);
      fireEvent.pointerUp(button('Increase'));
      tick(1000);
      expect(onCommit).toHaveBeenCalledTimes(4);
    });

    it('read the delay and the interval from the tokens', () => {
      vi.useFakeTimers();
      const onCommit = vi.fn();
      render(
        <Field.Root aria-label="Quantity">
          <Field.NumberInput value={0} onValueChange={onCommit} />
          <Field.Increment style={{ '--todae-field-stepper-repeat-delay': '0.1s', '--todae-field-stepper-repeat-interval': '20ms' } as React.CSSProperties} />
        </Field.Root>,
      );
      fireEvent.pointerDown(button('Increase'), { button: 0 });
      tick(100);
      tick(20);
      tick(20);
      expect(onCommit).toHaveBeenCalledTimes(1 + 2);
    });

    it('stop when the pointer leaves, is cancelled, or the button loses focus', () => {
      vi.useFakeTimers();
      const onCommit = vi.fn();
      render(<Quantity initial={0} buttons onCommit={onCommit} />);
      for (const end of ['pointerLeave', 'pointerCancel', 'blur'] as const) {
        onCommit.mockClear();
        fireEvent.pointerDown(button('Increase'), { button: 0 });
        fireEvent[end](button('Increase'));
        tick(2000);
        expect(onCommit, end).toHaveBeenCalledTimes(1);
      }
    });

    it('stop at the bound, where the button turns disabled', () => {
      vi.useFakeTimers();
      const onCommit = vi.fn();
      render(<Quantity initial={0} max={2} buttons onCommit={onCommit} />);
      fireEvent.pointerDown(button('Increase'), { button: 0 });
      tick(400);
      for (let repeat = 0; repeat < 5; repeat++) tick(60);
      expect(onCommit).toHaveBeenCalledTimes(2);
      expect(onCommit).toHaveBeenLastCalledWith(2);
      expect(button('Increase').disabled).toBe(true);
    });

    it('ignore a press that is not the primary button, and stop when they unmount', () => {
      vi.useFakeTimers();
      const onCommit = vi.fn();
      const { unmount } = render(<Quantity initial={0} buttons onCommit={onCommit} />);
      fireEvent.pointerDown(button('Increase'), { button: 2 });
      expect(onCommit).not.toHaveBeenCalled();
      fireEvent.pointerDown(button('Increase'), { button: 0 });
      unmount();
      tick(2000);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  it('are disabled until a number input registers, and warn when none does', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      <Field.Root aria-label="Quantity">
        <Field.Increment />
      </Field.Root>,
    );
    expect(button('Increase').disabled).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Field.NumberInput'));
  });

  it('belong to the number input of their own field', () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <>
        <Field.Root aria-label="First">
          <Field.NumberInput value={1} onValueChange={first} />
        </Field.Root>
        <Field.Root aria-label="Second">
          <Field.NumberInput value={1} onValueChange={second} />
          <Field.Increment />
        </Field.Root>
      </>,
    );
    fireEvent.click(button('Increase'), { detail: 0 });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(2);
  });

  it('throw outside Field.Root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Field.Increment />)).toThrow('Field.Root');
  });
});

describe('Field.NumberInput in a form', () => {
  const entries = (form: HTMLElement) => [...new FormData(form as HTMLFormElement).entries()];

  it('sends the number as HTML writes it whatever the locale, from the value input', () => {
    for (const locale of ['en-US', 'de-DE', 'ko-KR', 'fr-FR', 'ar-EG']) {
      cleanup();
      render(
        <form data-testid="form">
          <Quantity initial={1234.5} locale={locale} />
        </form>,
      );
      expect(entries(screen.getByTestId('form')), locale).toEqual([['quantity', '1234.5']]);
    }
  });

  it('sends nothing for no number, and the text input never sends', () => {
    render(
      <form data-testid="form">
        <Quantity />
      </form>,
    );
    expect(entries(screen.getByTestId('form'))).toEqual([['quantity', '']]);
    expect(input().name).toBe('');
    expect(valueInput().name).toBe('quantity');
  });

  it('gives the name to a name prop, and goes without one beside a control that took the field name', () => {
    render(
      <form data-testid="form">
        <Field.Root aria-label="Price" name="price">
          <Field.NumberInput value={3} name="amount" />
        </Field.Root>
        <Field.Root aria-label="Both" name="both">
          <Field.TextInput value="x" onChange={() => undefined} />
          <Field.NumberInput value={3} />
        </Field.Root>
      </form>,
    );
    expect(entries(screen.getByTestId('form'))).toEqual([
      ['amount', '3'],
      ['both', 'x'],
    ]);
  });

  it('hands the value input the bounds, the step and required, with step any when there is none', () => {
    const { rerender } = render(<Quantity initial={3} min={1} max={9} step={2} required />);
    expect(valueInput().type).toBe('number');
    expect(valueInput().min).toBe('1');
    expect(valueInput().max).toBe('9');
    expect(valueInput().step).toBe('2');
    expect(valueInput().required).toBe(true);
    rerender(<Quantity initial={3} />);
    expect(valueInput().step).toBe('any');
    expect(valueInput().validity.valid).toBe(true);
  });

  it('is no tab stop and takes no press on the shell, only the text input does', () => {
    render(<Quantity initial={3} buttons />);
    const shell = input().parentElement!;
    fireEvent.mouseDown(shell);
    expect(document.activeElement).toBe(input());
    expect(valueInput().tabIndex).toBe(-1);
  });

  it('blocks a submit with no number when required, in Form.Root, and focuses the text input', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <Field.Group>
          <Label.Root htmlFor="qty">Quantity</Label.Root>
          <Field.Root id="qty" name="quantity">
            <Field.NumberInput value={null} required />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeTruthy();
    expect(document.activeElement).toBe(input());
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')).toContain(screen.getByText('This field is required').id);
  });

  it("words the bounds in the field's own format", async () => {
    const bounds = async (locale: string, value: number, formatOptions?: Intl.NumberFormatOptions) => {
      cleanup();
      await mount(
        <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
          <Field.Group>
            <Field.Root name="price" aria-label="Price">
              <Field.NumberInput value={value} min={1000} max={50000} locale={locale} formatOptions={formatOptions} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Form.Root>,
      );
      await submit(screen.getByTestId('form'));
      return document.querySelector('[data-todae-error]')?.textContent;
    };
    expect(await bounds('de', 500)).toBe('Enter 1.000 or more');
    expect(await bounds('en', 60000)).toBe('Enter 50,000 or less');
    expect(await bounds('ko', 500, { style: 'currency', currency: 'KRW' })).toBe('Enter ₩1,000 or more');
    expect(await bounds('fr', 60000)).toBe('Enter 50 000 or less');
  });

  it('shows a value off its step as a step mismatch', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Field.Group>
          <Field.Root name="price" aria-label="Price">
            <Field.NumberInput value={7} min={0} step={5} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(document.querySelector('[data-todae-error]')?.textContent).toBe('Enter a value that fits the allowed steps');
  });

  it('counts a commit as an edit that hides the field server error, and typing alone does not', async () => {
    function Page() {
      const [value, setValue] = useState<number | null>(3);
      return (
        <Form.Root data-testid="form" errors={{ quantity: 'Only 2 left' }} onSubmit={(event) => event.preventDefault()}>
          <Field.Group>
            <Field.Root name="quantity" aria-label="Quantity">
              <Field.NumberInput value={value} onValueChange={setValue} locale="en" />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Form.Root>
      );
    }
    await mount(<Page />);
    expect(screen.getByText('Only 2 left')).toBeTruthy();
    await act(async () => type('2'));
    expect(screen.getByText('Only 2 left')).toBeTruthy();
    await act(async () => {
      fireEvent.blur(input());
    });
    expect(screen.queryByText('Only 2 left')).toBeNull();
  });

  it('commits on Enter before the form reads its value', async () => {
    const seen: (string | null)[] = [];
    await mount(
      <Form.Root
        data-testid="form"
        onSubmit={(event) => {
          event.preventDefault();
          seen.push(new FormData(event.currentTarget).get('quantity') as string | null);
        }}
      >
        <Quantity locale="en" />
        <button type="submit">Send</button>
      </Form.Root>,
    );
    await act(async () => type('42'));
    await act(async () => {
      key('Enter');
    });
    await submit(screen.getByTestId('form'));
    expect(seen).toEqual(['42']);
  });
});

describe('Field.NumberInput on the server', () => {
  it('renders the text in the locale, with the aria value', () => {
    const html = renderToString(
      <Field.Root aria-label="Quantity" name="quantity">
        <Field.NumberInput value={1234.5} locale="de" min={0} onValueChange={() => undefined} />
      </Field.Root>,
    );
    expect(html).toContain('value="1.234,5"');
    expect(html).toContain('role="spinbutton"');
    expect(html).toContain('aria-valuenow="1234.5"');
    expect(html).toContain('value="1234.5"');
  });
});
