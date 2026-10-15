import { cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHotkey } from './useHotkey.js';

afterEach(cleanup);

/** Dispatches a keydown from `target` and says whether it was left unprevented. */
function press(init: KeyboardEventInit, target: EventTarget = document.body) {
  return target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

describe('useHotkey', () => {
  it('runs the handler on a match and prevents the default', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('Control+K', handler));
    expect(press({ key: 'k', code: 'KeyK', ctrlKey: true })).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).toBeInstanceOf(KeyboardEvent);
  });

  it('needs exactly the named modifiers', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('Control+K', handler));
    expect(press({ key: 'k', code: 'KeyK' })).toBe(true);
    expect(press({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(press({ key: 'k', code: 'KeyK', metaKey: true })).toBe(true);
    // AltGr is Ctrl with Alt on Windows.
    expect(press({ key: 'ł', code: 'KeyK', ctrlKey: true, altKey: true })).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('matches any hotkey in a list', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey(['Control+K', 'Meta+K'], handler));
    press({ key: 'k', code: 'KeyK', ctrlKey: true });
    press({ key: 'k', code: 'KeyK', metaKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('matches the typed letter, or the key position when the layout types no Latin letter', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('Control+K', handler));
    // Dvorak: the key labelled K sits where QWERTY has V, and the key at K types t.
    expect(press({ key: 'k', code: 'KeyV', ctrlKey: true })).toBe(false);
    expect(press({ key: 't', code: 'KeyK', ctrlKey: true })).toBe(true);
    // Korean 2-set: the K position types ㅏ.
    expect(press({ key: 'ㅏ', code: 'KeyK', ctrlKey: true })).toBe(false);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('skips keys already prevented, composing, or repeating', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('Control+K', handler));
    const prevent = (event: KeyboardEvent) => event.preventDefault();
    document.body.addEventListener('keydown', prevent);
    press({ key: 'k', code: 'KeyK', ctrlKey: true });
    document.body.removeEventListener('keydown', prevent);
    press({ key: 'k', code: 'KeyK', ctrlKey: true, isComposing: true });
    expect(press({ key: 'k', code: 'KeyK', ctrlKey: true, repeat: true })).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('leaves a key that would type to the focused field', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey(['Shift+A', 'Control+K', 'F2'], handler));
    const { container } = render(
      <div>
        <input aria-label="Text" />
        <input type="checkbox" aria-label="Check" />
        <div contentEditable aria-label="Editor" />
      </div>,
    );
    const [text, check] = container.querySelectorAll('input');
    const editor = container.querySelector('[contenteditable]')!;
    expect(press({ key: 'A', code: 'KeyA', shiftKey: true }, text!)).toBe(true);
    Object.defineProperty(editor, 'isContentEditable', { value: true });
    expect(press({ key: 'A', code: 'KeyA', shiftKey: true }, editor)).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    // A checkbox types nothing, and neither does a Control chord or a function key.
    expect(press({ key: 'A', code: 'KeyA', shiftKey: true }, check!)).toBe(false);
    expect(press({ key: 'k', code: 'KeyK', ctrlKey: true }, text!)).toBe(false);
    expect(press({ key: 'F2', code: 'F2' }, text!)).toBe(false);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('stops listening while disabled and after unmount', () => {
    const handler = vi.fn();
    const { rerender, unmount } = renderHook(({ enabled }) => useHotkey('Control+K', handler, { enabled }), {
      initialProps: { enabled: false },
    });
    expect(press({ key: 'k', code: 'KeyK', ctrlKey: true })).toBe(true);
    rerender({ enabled: true });
    press({ key: 'k', code: 'KeyK', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
    expect(press({ key: 'k', code: 'KeyK', ctrlKey: true })).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('runs the latest inline handler without resubscribing', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const calls: number[] = [];
    const { rerender } = renderHook(({ n }) => useHotkey(['Control+K'], () => calls.push(n)), {
      initialProps: { n: 1 },
    });
    rerender({ n: 2 });
    press({ key: 'k', code: 'KeyK', ctrlKey: true });
    expect(calls).toEqual([2]);
    expect(add.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
    add.mockRestore();
  });

  it('warns about a hotkey it cannot read and leaves it off', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = vi.fn();
    renderHook(() => useHotkey(['Hyper+K', 'Control+J'], handler));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"Hyper+K"'));
    expect(error).toHaveBeenCalledTimes(1);
    expect(press({ key: 'k', code: 'KeyK' })).toBe(true);
    press({ key: 'j', code: 'KeyJ', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
