import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorMessage, Field, Form, GlyphsProvider, Label, StringsProvider } from '../index.js';
import { mount, submit } from '../test/form.js';
import type { NumberFormatOptions } from './numberText.js';
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
// A step button's name starts with the string, and goes on with the field's label.
const button = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) }) as HTMLButtonElement;

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

  it('asks for a keypad with a minus key unless the number cannot be negative, and takes any inputMode the product sets', () => {
    const { rerender } = render(<Quantity step={1} min={0} />);
    expect(input().getAttribute('inputmode')).toBe('numeric');
    rerender(<Quantity step={1} min={0} inputMode="search" />);
    expect(input().getAttribute('inputmode')).toBe('search');
    rerender(<Quantity step={1} min={0.5} />);
    expect(input().getAttribute('inputmode')).toBe('decimal');
    rerender(<Quantity min={0} />);
    expect(input().getAttribute('inputmode')).toBe('decimal');
    rerender(<Quantity step={1} min={-5} />);
    expect(input().getAttribute('inputmode')).toBe('text');
    rerender(<Quantity step={1} />);
    expect(input().getAttribute('inputmode')).toBe('text');
    rerender(<Quantity />);
    expect(input().getAttribute('inputmode')).toBe('text');
  });

  it('keeps the digit keypad for a format with no fraction, since it has no separator', () => {
    const { rerender } = render(<Quantity step={1} min={0} locale="en" formatOptions={{ style: 'currency', currency: 'USD' }} />);
    expect(input().getAttribute('inputmode')).toBe('decimal');
    rerender(<Quantity step={1} min={0} locale="en" formatOptions={{ style: 'percent' }} />);
    expect(input().getAttribute('inputmode')).toBe('decimal');
    rerender(<Quantity step={1} min={0} locale="ja" formatOptions={{ style: 'currency', currency: 'JPY' }} />);
    expect(input().getAttribute('inputmode')).toBe('numeric');
    rerender(<Quantity step={1} min={0} locale="en" formatOptions={{ maximumFractionDigits: 1 }} />);
    expect(input().getAttribute('inputmode')).toBe('decimal');
    rerender(<Quantity step={1} min={0} locale="en" formatOptions={{ maximumFractionDigits: 0 }} />);
    expect(input().getAttribute('inputmode')).toBe('numeric');
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

  it('takes any text on change, and reads or flags it on commit', () => {
    const onCommit = vi.fn();
    render(<Quantity locale="en" initial={12} onCommit={onCommit} />);
    type('12e');
    expect(input().value).toBe('12e');
    type('12.5.');
    expect(input().value).toBe('12.5.');
    fireEvent.blur(input());
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it.each([
    ['5 kilometers', { style: 'unit', unit: 'kilometer', unitDisplay: 'long' }],
    ['5.00 US dollars', { style: 'currency', currency: 'USD', currencyDisplay: 'name' }],
  ] as const)('lets a person delete through %s one character at a time', (full, formatOptions) => {
    render(<Quantity locale="en" initial={5} formatOptions={formatOptions} />);
    expect(input().value).toBe(full);
    for (let at = full.length - 1; at >= 0; at--) {
      type(full.slice(0, at));
      expect(input().value).toBe(full.slice(0, at));
    }
  });

  it('lands a paste the field does not read, and flags it on commit', () => {
    const onCommit = vi.fn();
    render(<Quantity locale="en" initial={3} onCommit={onCommit} />);
    input().setSelectionRange(0, 1);
    const paste = new InputEvent('beforeinput', { inputType: 'insertFromPaste', data: '$1,234.56', bubbles: true, cancelable: true });
    fireEvent(input(), paste);
    expect(paste.defaultPrevented).toBe(false);
    type('$1,234.56');
    expect(input().value).toBe('$1,234.56');
    fireEvent.blur(input());
    expect(input().value).toBe('$1,234.56');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(valueInput().validationMessage).toBe('Enter a valid value');
    expect(onCommit).not.toHaveBeenCalled();
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

  it('keeps a text that means no number, invalid, and reports nothing', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={3} locale="en" onCommit={onCommit} />);
    type('-');
    fireEvent.blur(input());
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('-');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(valueInput().validity.customError).toBe(true);
    expect(valueInput().validationMessage).toBe('Enter a valid value');
    expect(valueInput().value).toBe('3');
  });

  it.each([
    ['1.5', 'de'],
    ['1,5', 'en'],
    ['1234.56', 'de'],
  ])('keeps %s typed in %s, which the locale does not read, and is invalid until it does', (text, locale) => {
    const onCommit = vi.fn();
    render(<Quantity initial={3} locale={locale} onCommit={onCommit} />);
    expect(input().getAttribute('aria-invalid')).toBeNull();
    type(text);
    // Typing alone flags nothing.
    expect(input().getAttribute('aria-invalid')).toBeNull();
    fireEvent.blur(input());
    expect(input().value).toBe(text);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(valueInput().validity.valid).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
    // Still unreadable after more typing; a number clears it.
    type(`${text}1`);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    type(locale === 'de' ? '1.234,5' : '1,234.5');
    expect(input().getAttribute('aria-invalid')).toBeNull();
    expect(valueInput().validity.valid).toBe(true);
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(1234.5);
  });

  it('ends an unreadable text when the product sets a value', () => {
    const { rerender } = render(
      <Field.Root aria-label="Quantity">
        <Field.NumberInput value={3} onValueChange={() => undefined} locale="en" />
      </Field.Root>,
    );
    type('1,5');
    fireEvent.blur(input());
    expect(valueInput().validity.valid).toBe(false);
    rerender(
      <Field.Root aria-label="Quantity">
        <Field.NumberInput value={4} onValueChange={() => undefined} locale="en" />
      </Field.Root>,
    );
    expect(input().value).toBe('4');
    expect(input().getAttribute('aria-invalid')).toBeNull();
    expect(valueInput().validity.valid).toBe(true);
  });

  it('does not step from an unreadable text: it stays, and stays invalid', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={3} locale="en" buttons onCommit={onCommit} />);
    type('1,5');
    fireEvent.blur(input());
    expect(button('Increase').disabled).toBe(false);
    for (const name of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']) key(name);
    fireEvent.click(button('Increase'), { detail: 0 });
    fireEvent.click(button('Decrease'), { detail: 0 });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('1,5');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(valueInput().validity.valid).toBe(false);
  });

  it('clears an unreadable text when its form resets', () => {
    render(
      <form>
        <Quantity initial={3} locale="en" />
      </form>,
    );
    type('1,5');
    fireEvent.blur(input());
    expect(valueInput().validity.valid).toBe(false);
    act(() => {
      input().form!.reset();
    });
    expect(input().value).toBe('3');
    expect(input().getAttribute('aria-invalid')).toBeNull();
    expect(valueInput().validity.valid).toBe(true);
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

  it('lets a composition land whatever it makes, and reads or flags the text on commit', () => {
    const onCommit = vi.fn();
    render(<Quantity locale="en" initial={5} onCommit={onCommit} />);
    fireEvent.compositionStart(input());
    type('5ㅎ');
    expect(input().value).toBe('5ㅎ');
    fireEvent.compositionEnd(input());
    expect(input().value).toBe('5ㅎ');
    fireEvent.blur(input());
    expect(input().getAttribute('aria-invalid')).toBe('true');
    fireEvent.compositionStart(input());
    type('52');
    fireEvent.compositionEnd(input());
    expect(input().getAttribute('aria-invalid')).toBeNull();
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(52);
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
    expect(button('Increase').disabled).toBe(true);
    expect(button('Decrease').disabled).toBe(true);
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
    expect(button('Increase').disabled).toBe(true);
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

  it('leaves Home and End to the caret, as a native number input does', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={5} min={1} max={9} onCommit={onCommit} />);
    for (const name of ['Home', 'End']) {
      const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
      fireEvent(input(), event);
      expect(event.defaultPrevented, name).toBe(false);
    }
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('ends at the highest number on the step when max is off it', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={3} min={0} max={10} step={3} onCommit={onCommit} />);
    key('PageUp');
    expect(onCommit).toHaveBeenLastCalledWith(9);
  });

  it('leaves a key with a modifier to the browser', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={5} min={1} max={9} onCommit={onCommit} />);
    for (const init of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      key('ArrowUp', init);
      key('PageUp', init);
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
      <StringsProvider strings={{ increment: () => 'Augmenter', decrement: () => 'Diminuer' }}>
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

  it('are disabled from a number outside the range only for the step away from it', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={150} max={100} buttons onCommit={onCommit} />);
    expect(button('Increase').disabled).toBe(true);
    expect(button('Decrease').disabled).toBe(false);
    fireEvent.click(button('Decrease'), { detail: 0 });
    expect(onCommit).toHaveBeenLastCalledWith(100);
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

  it('holds the number Enter committed in the value input when the form is read', async () => {
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

describe('Field.NumberInput commits what the text shows', () => {
  const commitTyped = (typed: string, props: NumberProps) => {
    const onCommit = vi.fn();
    render(<Quantity onCommit={onCommit} {...props} />);
    type(typed);
    fireEvent.blur(input());
    return onCommit;
  };

  it('rounds a currency to its digits, so the text, aria-valuenow, the value input and onValueChange agree', () => {
    const onCommit = commitTyped('19.999', { locale: 'en', formatOptions: { style: 'currency', currency: 'USD' } });
    expect(onCommit).toHaveBeenCalledWith(20);
    expect(input().value).toBe('$20.00');
    expect(input().getAttribute('aria-valuenow')).toBe('20');
    expect(input().getAttribute('aria-valuetext')).toBe('$20.00');
    expect(valueInput().value).toBe('20');
  });

  it('rounds a percent to the percent it shows, two digits below the fraction', () => {
    const onCommit = commitTyped('7.5', { locale: 'en', formatOptions: { style: 'percent' } });
    expect(onCommit).toHaveBeenCalledWith(0.08);
    expect(input().value).toBe('8%');
    expect(valueInput().value).toBe('0.08');
  });

  it('rounds a yen to whole yen, and an explicit digit option to its digits', () => {
    expect(commitTyped('1234.4', { locale: 'ja', formatOptions: { style: 'currency', currency: 'JPY' } })).toHaveBeenCalledWith(1234);
    cleanup();
    const onCommit = commitTyped('1.26', { locale: 'en', formatOptions: { maximumFractionDigits: 1 } });
    expect(onCommit).toHaveBeenCalledWith(1.3);
    expect(input().value).toBe('1.3');
    expect(valueInput().value).toBe('1.3');
  });

  it('keeps every digit of a plain number, and rounds as the text does', () => {
    expect(commitTyped('1.23456789', { locale: 'en' })).toHaveBeenCalledWith(1.23456789);
    cleanup();
    expect(commitTyped('1.005', { locale: 'en', formatOptions: { maximumFractionDigits: 2 } })).toHaveBeenCalledWith(1.01);
  });

  it('steps from a rounded value to a rounded value', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={19.99} locale="en" formatOptions={{ style: 'currency', currency: 'USD' }} onCommit={onCommit} />);
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(20.99);
    expect(valueInput().value).toBe('20.99');
  });
});

describe('Field.NumberInput stepping', () => {
  it('does not pile up float error with no step: 1.1 down is 0.1, and 0.3 down and up is 0.3', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<Quantity initial={1.1} onCommit={onCommit} />);
    key('ArrowDown');
    expect(onCommit).toHaveBeenLastCalledWith(0.1);
    expect(valueInput().value).toBe('0.1');
    unmount();
    render(<Quantity initial={0.3} onCommit={onCommit} />);
    key('ArrowDown');
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(0.3);
    expect(valueInput().value).toBe('0.3');
  });

  it('steps a percent by one shown percent, and the page keys by ten', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={0.5} locale="en" formatOptions={{ style: 'percent' }} buttons onCommit={onCommit} />);
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(0.51);
    expect(input().value).toBe('51%');
    fireEvent.click(button('Decrease'), { detail: 0 });
    fireEvent.click(button('Decrease'), { detail: 0 });
    expect(onCommit).toHaveBeenLastCalledWith(0.49);
    key('PageUp');
    expect(onCommit).toHaveBeenLastCalledWith(0.59);
  });

  it('is on the step it is given, and treats a step that is no length as none', () => {
    const onCommit = vi.fn();
    for (const step of [0, -5, Number.NaN]) {
      cleanup();
      onCommit.mockClear();
      render(<Quantity initial={2} step={step} onCommit={onCommit} />);
      expect(valueInput().step).toBe('any');
      key('ArrowUp');
      expect(onCommit).toHaveBeenLastCalledWith(3);
      type('1.25');
      fireEvent.blur(input());
      expect(onCommit).toHaveBeenLastCalledWith(1.25);
    }
  });

  it('lets the buttons and the keys agree at a bound that is off the step', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={9} min={0} max={10} step={3} buttons onCommit={onCommit} />);
    expect(button('Increase').disabled).toBe(true);
    expect(button('Decrease').disabled).toBe(false);
    key('ArrowUp');
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(button('Decrease'), { detail: 0 });
    expect(onCommit).toHaveBeenLastCalledWith(6);
    expect(button('Increase').disabled).toBe(false);
  });

  it('lands on the bound from a value outside the range when stepping toward it, and does nothing stepping away', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<Quantity initial={150} max={100} onCommit={onCommit} />);
    key('ArrowUp');
    key('PageUp');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('150');
    key('ArrowDown');
    expect(onCommit).toHaveBeenLastCalledWith(100);
    unmount();
    onCommit.mockClear();
    render(<Quantity initial={-4} min={0} step={5} onCommit={onCommit} />);
    key('ArrowDown');
    expect(onCommit).not.toHaveBeenCalled();
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(0);
  });

  it('steps to the next point of the step grid from a value off it', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<Quantity initial={13} step={5} onCommit={onCommit} />);
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(15);
    unmount();
    render(<Quantity initial={7} step={5} onCommit={onCommit} />);
    key('ArrowDown');
    expect(onCommit).toHaveBeenLastCalledWith(5);
    cleanup();
    render(<Quantity initial={0.15} step={0.1} onCommit={onCommit} />);
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(0.2);
    cleanup();
    render(<Quantity initial={2.5} step={1} onCommit={onCommit} />);
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(3);
  });

  it('steps a percent down from 8% with a step finer than a shown percent, as the grid says', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={0.08} step={0.005} locale="en" formatOptions={{ style: 'percent' }} buttons onCommit={onCommit} />);
    expect(button('Decrease').disabled).toBe(false);
    key('ArrowDown');
    expect(onCommit).toHaveBeenLastCalledWith(0.075);
    expect(valueInput().value).toBe('0.075');
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(0.08);
  });

  it('leaves Decrement enabled at 8% with no min, and steps a yen by a half', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<Quantity initial={0.08} locale="en" formatOptions={{ style: 'percent' }} buttons onCommit={onCommit} />);
    expect(button('Decrease').disabled).toBe(false);
    expect(button('Increase').disabled).toBe(false);
    unmount();
    render(<Quantity initial={1} step={0.5} locale="ja" formatOptions={{ style: 'currency', currency: 'JPY' }} buttons onCommit={onCommit} />);
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(1.5);
    key('ArrowDown');
    expect(onCommit).toHaveBeenLastCalledWith(1);
  });

  it('warns once in development for a step, min or max finer than the text shows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<Quantity initial={1} step={0.5} locale="ja" formatOptions={{ style: 'currency', currency: 'JPY' }} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('more decimals than its format shows'));
    cleanup();
    warn.mockClear();
    resetWarnOnce();
    render(<Quantity initial={1} min={0.005} locale="en" formatOptions={{ style: 'currency', currency: 'USD' }} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('more decimals than its format shows'));
    cleanup();
    warn.mockClear();
    resetWarnOnce();
    render(<Quantity initial={1} step={0.01} locale="en" formatOptions={{ style: 'currency', currency: 'USD' }} />);
    render(<Quantity initial={1} step={0.1} locale="en" />);
    expect(warn).not.toHaveBeenCalled();
  });

  it('takes a largeStep that is no length as none', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={50} step={2} largeStep={0} onCommit={onCommit} />);
    key('PageUp');
    expect(onCommit).toHaveBeenLastCalledWith(70);
  });

  it('lets a min above the max win', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onCommit = vi.fn();
    render(<Quantity min={10} max={5} step={1} onCommit={onCommit} />);
    type('7');
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(10);
    type('2');
    fireEvent.blur(input());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('max below its min'));
    cleanup();
    render(<Quantity min={10} max={5} onCommit={onCommit} />);
    type('7');
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(10);
  });

  it.each([['maximumSignificantDigits', 2], ['roundingMode', 'floor'], ['roundingPriority', 'lessPrecision']])(
    'warns once in development for the %s option, which TypeScript rejects',
    (option, value) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      // A JavaScript caller, or a cast, can still pass it.
      render(<Quantity initial={1234} locale="en" formatOptions={{ [option]: value } as NumberFormatOptions} />);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('does not support'));
    },
  );
});

describe('Field.NumberInput typing', () => {
  const beforeInput = (inputType: string, data: string | null, caret: [number, number]) => {
    input().setSelectionRange(...caret);
    const event = new InputEvent('beforeinput', { inputType, data, bubbles: true, cancelable: true });
    fireEvent(input(), event);
    return event;
  };

  it('refuses a typed character that could not become a number before it lands, so the caret stays', () => {
    render(<Quantity initial={123} locale="en" />);
    expect(beforeInput('insertText', 'a', [1, 1]).defaultPrevented).toBe(true);
    expect(beforeInput('insertText', '5', [1, 1]).defaultPrevented).toBe(false);
    expect(beforeInput('insertText', '.', [3, 3]).defaultPrevented).toBe(false);
    // A paste lands, and is read or flagged on commit.
    expect(beforeInput('insertFromPaste', '4.5.6', [0, 3]).defaultPrevented).toBe(false);
    expect(beforeInput('insertFromPaste', '$1,234.56', [0, 3]).defaultPrevented).toBe(false);
    expect(beforeInput('insertText', null, [0, 0]).defaultPrevented).toBe(false);
    expect(beforeInput('deleteContentBackward', null, [0, 0]).defaultPrevented).toBe(false);
    expect(beforeInput('insertCompositionText', 'ㅎ', [0, 0]).defaultPrevented).toBe(false);
  });

  it('says exactly what is on screen as aria-valuetext, typed or not', () => {
    render(<Quantity initial={5} locale="en" />);
    expect(input().getAttribute('aria-valuetext')).toBe('5');
    type('12');
    expect(input().getAttribute('aria-valuetext')).toBe('12');
    type('1,2');
    expect(input().getAttribute('aria-valuetext')).toBe('1,2');
    type('');
    expect(input().hasAttribute('aria-valuetext')).toBe(false);
    type('12');
    fireEvent.blur(input());
    expect(input().getAttribute('aria-valuetext')).toBe('12');
  });

  it('is styled by an attribute of its own, not by its role', () => {
    render(<Quantity initial={5} />);
    expect(input().hasAttribute('data-todae-number-input')).toBe(true);
  });
});

describe('Field.Increment and Field.Decrement names and the stepper channel', () => {
  it('say whose number they step, from the Root label, a Label, or aria-labelledby', () => {
    render(
      <>
        <Field.Root aria-label="Adults" name="adults">
          <Field.NumberInput value={1} onValueChange={() => undefined} />
          <Field.Increment />
        </Field.Root>
        <Label.Root htmlFor="kids">Children</Label.Root>
        <Field.Root id="kids" name="kids">
          <Field.Decrement />
          <Field.NumberInput value={1} onValueChange={() => undefined} />
        </Field.Root>
        <span id="rooms-label">Rooms</span>
        <Field.Root aria-labelledby="rooms-label" name="rooms">
          <Field.Decrement />
          <Field.NumberInput value={1} onValueChange={() => undefined} />
        </Field.Root>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Increase Adults' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decrease Children' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decrease Rooms' })).toBeTruthy();
  });

  it('take the word order from the strings, which are given the label', () => {
    render(
      <StringsProvider strings={{ increment: (field) => `${field} 증가`, decrement: (field) => (field ? `${field} 감소` : '감소') }}>
        <Field.Root aria-label="수량" name="quantity">
          <Field.NumberInput value={1} onValueChange={() => undefined} />
          <Field.Increment />
          <Field.Decrement />
        </Field.Root>
        <Field.Root name="unnamed">
          <Field.NumberInput value={1} onValueChange={() => undefined} aria-label="" />
          <Field.Decrement />
        </Field.Root>
      </StringsProvider>,
    );
    expect(screen.getByRole('button', { name: '수량 증가' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '수량 감소' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '감소' })).toBeTruthy();
  });

  it('follow a label that changes', () => {
    function Labelled({ label }: { label: string }) {
      return (
        <Field.Root aria-label={label}>
          <Field.NumberInput value={1} onValueChange={() => undefined} />
          <Field.Increment />
        </Field.Root>
      );
    }
    const { rerender } = render(<Labelled label="Adults" />);
    expect(screen.getByRole('button', { name: 'Increase Adults' })).toBeTruthy();
    rerender(<Labelled label="Guests" />);
    expect(screen.getByRole('button', { name: 'Increase Guests' })).toBeTruthy();
  });

  it('keep the name a product gives them', () => {
    render(
      <Field.Root aria-label="Adults">
        <Field.NumberInput value={1} onValueChange={() => undefined} />
        <Field.Increment aria-label="One more" />
        <Field.Decrement>Fewer</Field.Decrement>
      </Field.Root>,
    );
    expect(screen.getByRole('button', { name: 'One more' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fewer' })).toBeTruthy();
  });

  it('warn when a second number input registers in one Field.Root, and leave the later one its buttons when the earlier goes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const first = vi.fn();
    const second = vi.fn();
    function Both({ showFirst }: { showFirst: boolean }) {
      return (
        <Field.Root aria-label="Quantity">
          {showFirst ? <Field.NumberInput value={1} onValueChange={first} /> : null}
          <Field.NumberInput value={5} onValueChange={second} />
          <Field.Increment />
        </Field.Root>
      );
    }
    const { rerender } = render(<Both showFirst />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('more than one Field.NumberInput'));
    rerender(<Both showFirst={false} />);
    expect(button('Increase').disabled).toBe(false);
    fireEvent.click(button('Increase'), { detail: 0 });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(6);
  });

  it('go disabled when the only number input unmounts', () => {
    function One({ show }: { show: boolean }) {
      return (
        <Field.Root aria-label="Quantity">
          {show ? <Field.NumberInput value={1} onValueChange={() => undefined} /> : null}
          <Field.Increment />
        </Field.Root>
      );
    }
    const { rerender } = render(<One show />);
    expect(button('Increase').disabled).toBe(false);
    rerender(<One show={false} />);
    expect(button('Increase').disabled).toBe(true);
  });
});

describe('Field.NumberInput with a text that is no number, in a form', () => {
  it('blocks a submit, shows the message and marks the input, until the text is a number', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    function Page() {
      const [value, setValue] = useState<number | null>(3);
      return (
        <Form.Root data-testid="form" onSubmit={onSubmit}>
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
    await act(async () => type('1,5'));
    await act(async () => {
      fireEvent.blur(input());
    });
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid value')).toBeTruthy();
    expect(input().value).toBe('1,5');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    await act(async () => type('15'));
    await act(async () => {
      key('Enter');
    });
    await submit(screen.getByTestId('form'));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.queryByText('Enter a valid value')).toBeNull();
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
