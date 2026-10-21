import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from '../index.js';
import { Quantity, input, valueInput, type, key, button } from '../test/number.js';
import { resetWarnOnce } from './warnOnce.js';

afterEach(() => {
  cleanup();
  resetWarnOnce();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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
    // The text blocks a submit as it is typed, but is no announced error while more typing could mend it.
    type(text);
    expect(valueInput().validity.valid).toBe(false);
    expect(input().getAttribute('aria-invalid')).toBeNull();
    fireEvent.blur(input());
    expect(input().value).toBe(text);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(valueInput().validity.valid).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
    // Typing on is no longer a failed read; a number clears it.
    type(`${text}1`);
    expect(valueInput().validity.valid).toBe(false);
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
    expect(button('Increase').disabled).toBe(true);
    expect(button('Decrease').disabled).toBe(true);
    for (const name of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']) key(name);
    fireEvent.click(button('Increase'), { detail: 0 });
    fireEvent.click(button('Decrease'), { detail: 0 });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('1,5');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(valueInput().validity.valid).toBe(false);
  });

  it('clears an unreadable text when its form resets', async () => {
    render(
      <form>
        <Quantity initial={3} locale="en" />
      </form>,
    );
    type('1,5');
    fireEvent.blur(input());
    expect(valueInput().validity.valid).toBe(false);
    await act(async () => {
      input().form!.reset();
      await new Promise((resolve) => setTimeout(resolve));
    });
    expect(input().value).toBe('3');
    expect(input().getAttribute('aria-invalid')).toBeNull();
    expect(valueInput().validity.valid).toBe(true);
  });

  it('flags an unreadable text as it is typed, before any commit', () => {
    render(<Quantity initial={3} locale="en" />);
    type('abc');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(valueInput().validity.valid).toBe(false);
    type('');
    expect(input().getAttribute('aria-invalid')).toBeNull();
    expect(valueInput().validity.valid).toBe(true);
  });

  it('drops a failed text when the field becomes read-only or disabled, so it blocks no form', () => {
    function Page({ readOnly, disabled }: { readOnly?: boolean; disabled?: boolean }) {
      return (
        <form>
          <Field.Root aria-label="Quantity" name="quantity" disabled={disabled}>
            <Field.NumberInput value={3} onValueChange={() => undefined} readOnly={readOnly} locale="en" />
          </Field.Root>
        </form>
      );
    }
    const { rerender } = render(<Page />);
    type('abc');
    fireEvent.blur(input());
    expect(valueInput().validity.valid).toBe(false);
    rerender(<Page readOnly />);
    expect(input().value).toBe('3');
    expect(input().getAttribute('aria-invalid')).toBeNull();
    expect(valueInput().validity.valid).toBe(true);
    rerender(<Page />);
    expect(input().value).toBe('3');
    type('abc');
    expect(valueInput().validity.valid).toBe(false);
    rerender(<Page disabled />);
    expect(valueInput().validity.valid).toBe(true);
    rerender(<Page />);
    expect(input().value).toBe('3');
  });

  it('keeps an unreadable text when a reset is cancelled', async () => {
    render(
      <form onReset={(event) => event.preventDefault()}>
        <Quantity initial={3} locale="en" />
      </form>,
    );
    type('1,5');
    fireEvent.blur(input());
    await act(async () => {
      input().form!.reset();
      await new Promise((resolve) => setTimeout(resolve));
    });
    expect(input().value).toBe('1,5');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(valueInput().validity.valid).toBe(false);
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

describe('Field.NumberInput announces only a text no more typing could mend', () => {
  it('never flags a lone minus on the way to -5, yet blocks a submit meanwhile', () => {
    render(<Quantity initial={3} locale="en" />);
    const flagged: (string | null)[] = [];
    for (const text of ['-', '-5']) {
      type(text);
      flagged.push(input().getAttribute('aria-invalid'));
    }
    expect(flagged).toEqual([null, null]);
    type('-');
    expect(valueInput().validity.valid).toBe(false);
  });

  it('flags a half-typed text once a commit could not read it, and unflags it when typing goes on', () => {
    render(<Quantity initial={3} locale="en" />);
    type('-');
    fireEvent.blur(input());
    expect(input().getAttribute('aria-invalid')).toBe('true');
    type('-5');
    expect(input().getAttribute('aria-invalid')).toBeNull();
  });

  it('flags it once a step key could not read it', () => {
    render(<Quantity initial={3} locale="en" />);
    type('-');
    key('ArrowUp');
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps the step buttons enabled while the text is half typed, as in de on the way to 1.000', () => {
    render(<Quantity initial={3} locale="de" buttons />);
    for (const text of ['1.', '1.0', '1.00']) {
      type(text);
      expect(input().getAttribute('aria-invalid'), text).toBeNull();
      expect(button('Increase').disabled, text).toBe(false);
      expect(button('Decrease').disabled, text).toBe(false);
    }
  });
});

describe('Field.NumberInput warns about a value off its grid', () => {
  it('warns once when a value is off the grid counted from 0, and not on it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { rerender } = render(<Quantity initial={10} step={5} />);
    expect(warn).not.toHaveBeenCalled();
    rerender(<Field.Root aria-label="Other"><Field.NumberInput value={7} step={5} onValueChange={() => undefined} /></Field.Root>);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('off its step grid');
    expect(String(warn.mock.calls[0]?.[0])).toContain('from 0');
  });
});

describe('Field.NumberInput at a 16-digit value', () => {
  it('commits a typed 16-digit number unchanged, and disables Increment where a double cannot step', () => {
    const onCommit = vi.fn();
    render(<Quantity locale="en" step={1} buttons onCommit={onCommit} />);
    type('1234567890123456');
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(1234567890123456);
    expect(button('Increase').disabled).toBe(false);
    type('9007199254740992');
    expect(button('Increase').disabled).toBe(true);
    key('ArrowUp');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
