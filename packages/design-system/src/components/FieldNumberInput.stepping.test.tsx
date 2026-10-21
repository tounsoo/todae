import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Quantity, input, valueInput, type, key, button, type NumberProps } from '../test/number.js';
import type { NumberFormatOptions } from './numberText.js';
import { resetWarnOnce } from './warnOnce.js';

afterEach(() => {
  cleanup();
  resetWarnOnce();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  it('commits a large number on its step, whole', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<Quantity locale="en" step={0.01} formatOptions={{ minimumFractionDigits: 2 }} onCommit={onCommit} />);
    type('12345678901.23');
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(12345678901.23);
    expect(valueInput().value).toBe('12345678901.23');
    unmount();
    render(<Quantity locale="en" step={1} onCommit={onCommit} />);
    type('1234567890123');
    fireEvent.blur(input());
    expect(onCommit).toHaveBeenLastCalledWith(1234567890123);
  });

  it('rounds largeStep to whole steps, and warns once in development when it is not a multiple', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onCommit = vi.fn();
    const { rerender } = render(<Quantity initial={50} step={5} largeStep={12} onCommit={onCommit} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('largeStep that is not a multiple of its step'));
    key('PageUp');
    // 12 is 2.4 steps, which is 2.
    expect(onCommit).toHaveBeenLastCalledWith(60);
    warn.mockClear();
    resetWarnOnce();
    rerender(<Quantity initial={50} step={0.1} largeStep={0.3} onCommit={onCommit} />);
    rerender(<Quantity initial={50} step={5} largeStep={25} onCommit={onCommit} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([['notation', 'compact'], ['maximumSignificantDigits', 2], ['roundingMode', 'floor'], ['roundingPriority', 'lessPrecision']])(
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

describe('Field.NumberInput stepping a percent draft', () => {
  it('steps 7.5% up to 8%, the next shown percent, not 9%', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={0.05} locale="en" formatOptions={{ style: 'percent' }} onCommit={onCommit} />);
    type('7.5');
    key('ArrowUp');
    expect(onCommit).toHaveBeenLastCalledWith(0.08);
    expect(input().value).toBe('8%');
  });
});

describe('Field.NumberInput on a grid read at large operands', () => {
  it.each([
    [100, 0.1, 100.3],
    [100, 0.1, 100.7],
    [1000, 0.01, 1000.05],
    [1000, 0.01, 1000.07],
    [14.63, 0.005, 15.045],
  ])('min %s, step %s: steps both ways from %s with no off-grid warning', (min, step, at) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Quantity initial={at} min={min} step={step} locale="en" formatOptions={{ maximumFractionDigits: 3 }} buttons />);
    expect(warn).not.toHaveBeenCalled();
    expect(button('Increase').disabled).toBe(false);
    expect(button('Decrease').disabled).toBe(false);
    act(() => key('ArrowUp'));
    expect(Number(valueInput().value)).toBeGreaterThan(at);
    act(() => key('ArrowDown'));
    act(() => key('ArrowDown'));
    expect(Number(valueInput().value)).toBeLessThan(at);
  });

  it('commits the clean grid point of a max with noise below it, and the value input accepts it', () => {
    render(<Quantity initial={null} min={0} max={0.3 - 0.1} step={0.1} locale="en" />);
    type('5');
    fireEvent.blur(input());
    expect(input().value).toBe('0.2');
    expect(valueInput().value).toBe('0.2');
    expect(valueInput().max).toBe('0.2');
    expect(valueInput().validity.valid).toBe(true);
    expect(input().getAttribute('aria-valuemax')).toBe('0.2');
  });
});
