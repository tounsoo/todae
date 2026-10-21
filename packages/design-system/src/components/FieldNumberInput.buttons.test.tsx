import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, GlyphsProvider, Label, StringsProvider } from '../index.js';
import { Quantity, input, type, button } from '../test/number.js';
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

  it('are enabled by the typed text they step, not the committed value', () => {
    const onCommit = vi.fn();
    render(<Quantity initial={0} min={0} buttons onCommit={onCommit} />);
    expect(button('Decrease').disabled).toBe(true);
    type('5');
    expect(button('Decrease').disabled).toBe(false);
    fireEvent.click(button('Decrease'), { detail: 0 });
    expect(onCommit).toHaveBeenLastCalledWith(4);
  });

  it('go disabled at a bound the typed text is at, not the committed value', () => {
    render(<Quantity initial={10} max={10} buttons />);
    expect(button('Increase').disabled).toBe(true);
    type('5');
    expect(button('Increase').disabled).toBe(false);
    type('10');
    expect(button('Increase').disabled).toBe(true);
  });

  it('are disabled while the typed text is no number, and enabled again with a number', () => {
    render(<Quantity initial={3} locale="en" buttons />);
    type('abc');
    expect(button('Increase').disabled).toBe(true);
    expect(button('Decrease').disabled).toBe(true);
    type('4');
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

  it('follow a label that changes', async () => {
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
    expect(await screen.findByRole('button', { name: 'Increase Guests' })).toBeTruthy();
  });

  it('follow a label whose text a child changes on its own', async () => {
    let rename = (_name: string) => {};
    function Name() {
      const [name, setName] = useState('Adults');
      rename = setName;
      return <>{name}</>;
    }
    render(
      <>
        <Label.Root htmlFor="people">
          <Name />
        </Label.Root>
        <Field.Root id="people" name="people">
          <Field.NumberInput value={1} onValueChange={() => undefined} />
          <Field.Increment />
        </Field.Root>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Increase Adults' })).toBeTruthy();
    act(() => rename('Guests'));
    expect(await screen.findByRole('button', { name: 'Increase Guests' })).toBeTruthy();
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

  it('warn about a missing number input once on mount, not when it goes later', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    function One({ show }: { show: boolean }) {
      return (
        <Field.Root aria-label="Quantity">
          {show ? <Field.NumberInput value={1} onValueChange={() => undefined} /> : null}
          <Field.Increment />
        </Field.Root>
      );
    }
    const { rerender } = render(<One show />);
    expect(warn).not.toHaveBeenCalled();
    rerender(<One show={false} />);
    expect(warn).not.toHaveBeenCalled();
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
