import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Button } from '../components/Button.js';
import { Field } from '../components/Field.js';
import { OptionList } from '../components/OptionList.js';
import { Popover } from '../components/Popover.js';
import { optionDomId } from '../components/OptionList.ids.js';
import { resetMatchMedia, setMatchMedia } from '../test/setup.js';
import * as api from '../index.js';
import type { BottomSheetRootProps } from '../components/BottomSheet.js';
import type { DialogRootProps } from '../components/Dialog.js';
import { Activity, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { StringsProvider } from '../providers/StringsProvider.js';
import {
  useCombobox,
  type ComboboxOption,
  type UseComboboxResult,
  type UseComboboxSingleOptions,
} from './useCombobox.js';

afterEach(() => {
  cleanup();
  resetMatchMedia();
});

const OPTIONS: ComboboxOption[] = [
  { value: 'react', label: 'React' },
  { value: 'redux', label: 'Redux' },
  { value: 'svelte', label: 'Svelte', disabled: true },
  { value: 'vue', label: 'Vue' },
];

function SingleBox(props: Partial<UseComboboxSingleOptions> = {}) {
  const cb = useCombobox({ options: OPTIONS, presentation: 'popover', ...props });
  return (
    <div>
      <label {...cb.getLabelProps()}>Field</label>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.TextInput {...cb.getInputProps()} />
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root {...cb.getListboxProps()}>
          {cb.items.map((item) => (
            <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Popover.Root>
    </div>
  );
}

function MultiCreateBox({ onChange }: { onChange?: (value: string[]) => void } = {}) {
  const cb = useCombobox({
    selectionMode: 'multiple',
    options: OPTIONS,
    allowCreate: true,
    presentation: 'popover',
    onValueChange: onChange,
  });
  return (
    <div>
      <label {...cb.getLabelProps()}>Field</label>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.ChipInput {...cb.getChipInputProps()} />
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root {...cb.getListboxProps()}>
          {cb.items.map((item) => (
            <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Popover.Root>
    </div>
  );
}

/** Runs `run` with Vitest's unhandled-rejection listeners set aside, and returns the reasons it left unhandled. */
async function captureUnhandled(run: () => Promise<unknown>): Promise<unknown[]> {
  const reasons: unknown[] = [];
  const listeners = process.listeners('unhandledRejection');
  process.removeAllListeners('unhandledRejection');
  const onRejection = (reason: unknown) => {
    reasons.push(reason);
  };
  process.on('unhandledRejection', onRejection);
  try {
    await run();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    process.off('unhandledRejection', onRejection);
    for (const listener of listeners) process.on('unhandledRejection', listener);
  }
  return reasons;
}

function pointerSelect(option: HTMLElement) {
  const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  option.dispatchEvent(down);
  if (!down.defaultPrevented) {
    const list = option.closest('[role="listbox"]');
    if (list instanceof HTMLElement) list.focus();
  }
  fireEvent.click(option);
}

describe('useCombobox', () => {
  it('reports the trimmed filter query, empty while the input shows the committed label', () => {
    const { result } = renderHook(() =>
      useCombobox({
        options: [
          { value: 'sf', label: 'San Francisco' },
          { value: 'sj', label: 'San Jose' },
        ],
        presentation: 'popover',
        defaultValue: 'sj',
      }),
    );
    expect(result.current.inputValue).toBe('San Jose');
    expect(result.current.query).toBe('');
    act(() => result.current.setInputValue(' san '));
    expect(result.current.query).toBe('san');
  });

  it('exports hooks and does not export Combobox chrome', () => {
    expect(api).toHaveProperty('useCombobox');
    expect(api).toHaveProperty('useSheetPresentation');
    expect(api).not.toHaveProperty('Combobox');
  });

  it('wires combobox aria to the input and listbox', () => {
    render(<SingleBox defaultOpen />);
    const input = screen.getByRole('combobox');
    const list = screen.getByRole('listbox');
    expect(input.getAttribute('aria-controls')).toBe(list.id);
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(list.tabIndex).toBe(-1);
    expect(input.getAttribute('aria-activedescendant')).toBe(optionDomId(list.id, 'react'));
    expect(input.getAttribute('aria-haspopup')).toBeNull();
  });

  it('closes on an outside press and stays closed', () => {
    render(<SingleBox defaultOpen />);
    const input = screen.getByRole('combobox');
    input.focus();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    input.blur();
    fireEvent.pointerUp(document.body);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(document.body);
    // jsdom keeps the listbox mounted. A closed popover is what hides it in the browser.
    const popover = screen.getByRole('listbox').closest('[popover]');
    expect(popover?.matches(':popover-open')).toBe(false);
    expect(popover?.hasAttribute('data-popover-open')).toBe(false);
  });

  it('opens on focus and ArrowDown from closed highlights the first option', () => {
    const onOpenChange = vi.fn();
    render(<SingleBox onOpenChange={onOpenChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(onOpenChange).toHaveBeenCalledWith(true, 'trigger');
    expect(input.getAttribute('aria-activedescendant')).toBe(
      optionDomId(input.getAttribute('aria-controls') ?? '', 'react'),
    );
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(
      optionDomId(input.getAttribute('aria-controls') ?? '', 'redux'),
    );
  });

  it('keeps sibling options visible while the input shows the selected label', () => {
    const { result } = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        defaultValue: 'react',
        presentation: 'popover',
      }),
    );
    expect(result.current.inputValue).toBe('React');
    expect(result.current.items.map((item) => item.kind === 'option' && item.option.value)).toEqual([
      'react',
      'redux',
      'svelte',
      'vue',
    ]);
  });

  it('opens and moves with arrows, clamps, skips disabled, and selects with Enter', () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<SingleBox onValueChange={onChange} onOpenChange={onOpenChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onOpenChange).toHaveBeenCalledWith(true, 'trigger');
    expect(input.getAttribute('aria-activedescendant')).toBe(
      optionDomId(input.getAttribute('aria-controls') ?? '', 'react'),
    );
    fireEvent.keyDown(input, { key: 'End' });
    expect(input.getAttribute('aria-activedescendant')).toBe(
      optionDomId(input.getAttribute('aria-controls') ?? '', 'vue'),
    );
    fireEvent.keyDown(input, { key: 'Home' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(
      optionDomId(input.getAttribute('aria-controls') ?? '', 'redux'),
    );
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('redux');
    expect(onOpenChange).toHaveBeenCalledWith(false, 'select');
    expect(input).toHaveProperty('value', 'Redux');
  });

  it('closes on Escape and Tab', () => {
    const onOpenChange = vi.fn();
    render(<SingleBox defaultOpen onOpenChange={onOpenChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
    onOpenChange.mockClear();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onOpenChange).toHaveBeenCalledWith(false, 'blur');
  });

  it('closes the sheet once on Escape from the input', () => {
    const onOpenChange = vi.fn();
    function SheetBox() {
      const cb = useCombobox({
        options: OPTIONS,
        presentation: 'sheet',
        defaultOpen: true,
        onOpenChange,
      });
      return (
        <Field.Root>
          <Field.TextInput {...cb.getInputProps()} />
        </Field.Root>
      );
    }
    render(<SheetBox />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
  });

  it('clears single value when the input is emptied', () => {
    const onChange = vi.fn();
    render(<SingleBox defaultValue="react" onValueChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('keeps controlled open and value on the caller', () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<SingleBox open={false} value="react" onValueChange={onChange} onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    expect(onOpenChange).toHaveBeenCalledWith(true, 'trigger');
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[data-popover-open]')).toBeNull();
    fireEvent.click(document.body);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('filters one path and honors a custom filter', () => {
    const { result } = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        defaultInputValue: 're',
        presentation: 'popover',
      }),
    );
    expect(result.current.items.map((item) => item.kind === 'option' && item.option.value)).toEqual([
      'react',
      'redux',
    ]);
    const custom = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        defaultInputValue: 're',
        filter: (option) => option.value === 'vue',
        presentation: 'sheet',
      }),
    );
    expect(custom.result.current.items.map((item) => item.kind === 'option' && item.option.value)).toEqual([
      'vue',
    ]);
    expect(result.current.items).not.toEqual(custom.result.current.items);
  });

  it('discards stale async results and exposes retry', async () => {
    let resolveSlow: (value: ComboboxOption[]) => void = () => undefined;
    let rejectFast: (error: Error) => void = () => undefined;
    const loadOptions = vi.fn((query: string, _signal: AbortSignal) => {
      if (query === 'old') {
        return new Promise<ComboboxOption[]>((resolve) => {
          resolveSlow = resolve;
        });
      }
      if (query === 'boom') {
        return new Promise<ComboboxOption[]>((_resolve, reject) => {
          rejectFast = reject;
        });
      }
      return Promise.resolve([{ value: 'new', label: 'New' }]);
    });
    const { result, rerender } = renderHook(
      ({ query }) => useCombobox({ loadOptions, inputValue: query, presentation: 'popover' }),
      { initialProps: { query: 'old' } },
    );
    expect(result.current.loading).toBe(true);
    rerender({ query: 'new' });
    await act(async () => {
      resolveSlow([{ value: 'stale', label: 'Stale' }]);
      await Promise.resolve();
    });
    expect(result.current.items.map((item) => item.kind === 'option' && item.option.value)).toEqual([
      'new',
    ]);
    rerender({ query: 'boom' });
    await act(async () => {
      rejectFast(new Error('nope'));
      await Promise.resolve();
    });
    expect(result.current.error).toBeInstanceOf(Error);
    await act(async () => {
      result.current.retry();
      await Promise.resolve();
    });
    expect(loadOptions).toHaveBeenLastCalledWith('boom', expect.any(AbortSignal));
  });

  it('loads once per query when loadOptions is an inline function', async () => {
    const calls: string[] = [];
    const { result } = renderHook(() =>
      useCombobox({
        loadOptions: async (query) => {
          calls.push(query);
          return [{ value: 'a', label: 'A' }];
        },
        presentation: 'popover',
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calls).toEqual(['']);
    expect(result.current.loading).toBe(false);
  });

  it('reloads when loadKey changes even though loadOptions is read at call time', async () => {
    const calls: string[] = [];
    const { rerender } = renderHook(
      ({ category }) =>
        useCombobox({
          loadKey: category,
          loadOptions: async (query) => {
            calls.push(`${category}:${query}`);
            return [];
          },
          presentation: 'popover',
        }),
      { initialProps: { category: 'a' } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ category: 'b' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(calls).toEqual(['a:', 'b:']);
  });

  it('does not fall back to defaultValue for a controlled null value', () => {
    const { result } = renderHook(() =>
      useCombobox({ options: OPTIONS, value: null, defaultValue: 'vue', presentation: 'popover' }),
    );
    expect(result.current.inputValue).toBe('');
  });

  it('does not seed the input with a raw value that has no known label', async () => {
    const loadOptions = vi.fn(async () => []);
    const { result } = renderHook(() =>
      useCombobox({ loadOptions, value: 'user_42', presentation: 'popover' }),
    );
    expect(result.current.inputValue).toBe('');
    await act(async () => {
      await Promise.resolve();
    });
    expect(loadOptions).toHaveBeenCalledWith('', expect.any(AbortSignal));
  });

  it('seeds the input label from a controlled single value', () => {
    const { result } = renderHook(() =>
      useCombobox({ options: OPTIONS, value: 'vue', presentation: 'popover' }),
    );
    expect(result.current.inputValue).toBe('Vue');
  });

  it('keeps chip labels for selections that left the async result set', async () => {
    const { result } = renderHook(() =>
      useCombobox({
        selectionMode: 'multiple',
        loadOptions: async (query) =>
          query === '' ? [{ value: 'a', label: 'Alpha' }] : [{ value: 'b', label: 'Beta' }],
        presentation: 'popover',
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => result.current.select('a'));
    act(() => result.current.setInputValue('b'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.getChipInputProps().chips).toEqual(['Alpha']);
  });

  it('shows create when there is no case-insensitive match', async () => {
    const onCreate = vi.fn(() => 'todae');
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        allowCreate: true,
        defaultInputValue: 'Todae',
        defaultOpen: true,
        onCreate,
        onValueChange: onChange,
        presentation: 'popover',
      }),
    );
    expect(result.current.showCreate).toBe(true);
    expect(result.current.items.at(-1)).toMatchObject({ kind: 'create', value: 'Todae' });
    await act(async () => {
      result.current.create();
      await Promise.resolve();
    });
    expect(onCreate).toHaveBeenCalledWith('Todae');
    expect(onChange).toHaveBeenCalledWith('todae');
    const hidden = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        allowCreate: true,
        defaultInputValue: 'react',
        presentation: 'popover',
      }),
    );
    expect(hidden.result.current.showCreate).toBe(false);
  });

  it('keeps the rows across renders with an inline createLabel, and follows its text', () => {
    let prefix = 'Add';
    const { result, rerender } = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        allowCreate: true,
        defaultInputValue: 'Todae',
        createLabel: (query) => `${prefix} ${query}`,
        presentation: 'popover',
      }),
    );
    const before = result.current.items;
    rerender();
    expect(result.current.items).toBe(before);
    prefix = 'New';
    rerender();
    expect(result.current.items.at(-1)).toMatchObject({ kind: 'create', label: 'New Todae' });
  });

  it('gives the create row the id activeId names when it is highlighted', () => {
    const { result } = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        allowCreate: true,
        defaultInputValue: 'Zzz',
        defaultOpen: true,
        presentation: 'popover',
      }),
    );
    const row = result.current.items.at(-1)!;
    expect(row.kind).toBe('create');
    act(() => {
      result.current.getInputProps().onKeyDown?.({ key: 'ArrowDown', preventDefault() {}, nativeEvent: {} } as never);
    });
    expect(result.current.activeId).not.toBeNull();
    expect(result.current.activeId).toBe(row.id);
  });

  it('commits a create row from click in the same turn and closes single mode', () => {
    const onChange = vi.fn();
    render(<SingleBox allowCreate onValueChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'todae-x' } });
    pointerSelect(screen.getByRole('option', { name: 'Create "todae-x"' }));
    expect(onChange).toHaveBeenCalledWith('todae-x');
    expect(input).toHaveProperty('value', 'todae-x');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the filter input focused after create click and Enter in single mode', async () => {
    render(<SingleBox allowCreate />);
    const input = screen.getByRole('combobox');
    input.focus();
    fireEvent.change(input, { target: { value: 'todae-x' } });
    pointerSelect(screen.getByRole('option', { name: 'Create "todae-x"' }));
    expect(document.activeElement).toBe(input);
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-expanded')).toBe('false');

    fireEvent.change(input, { target: { value: 'todae-y' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('adds a create row as a chip and stays open in multiple mode', () => {
    const onChange = vi.fn();
    render(<MultiCreateBox onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'todae-x' } });
    pointerSelect(screen.getByRole('option', { name: 'Create "todae-x"' }));
    expect(onChange).toHaveBeenCalledWith(['todae-x']);
    expect(screen.getByRole('button', { name: 'Remove todae-x' })).toBeTruthy();
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps the chip filter focused after create click and Enter in multiple mode', async () => {
    render(<MultiCreateBox />);
    const input = screen.getByRole('combobox');
    input.focus();
    fireEvent.change(input, { target: { value: 'todae-x' } });
    pointerSelect(screen.getByRole('option', { name: 'Create "todae-x"' }));
    expect(document.activeElement).toBe(input);
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');

    fireEvent.change(input, { target: { value: 'todae-y' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('toggles multiple values and keeps the list open', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useCombobox({
        selectionMode: 'multiple',
        options: OPTIONS,
        defaultOpen: true,
        onValueChange: onChange,
        presentation: 'popover',
      }),
    );
    act(() => result.current.select('react'));
    expect(onChange).toHaveBeenCalledWith(['react']);
    expect(result.current.open).toBe(true);
    act(() => result.current.select('react'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('uses dialog haspopup on the sheet trigger', () => {
    const { result } = renderHook(() =>
      useCombobox({ options: OPTIONS, presentation: 'sheet' }),
    );
    expect(result.current.getTriggerProps()['aria-haspopup']).toBe('dialog');
    expect(result.current.isSheet).toBe(true);
  });

  it('follows auto presentation from matchMedia', () => {
    setMatchMedia('(pointer: coarse)', true);
    const { result } = renderHook(() => useCombobox({ options: OPTIONS, presentation: 'auto' }));
    expect(result.current.presentation).toBe('sheet');
    expect(result.current.isSheet).toBe(true);
  });

  it('keeps focus on the input when the popover opens', () => {
    render(<SingleBox />);
    const input = screen.getByRole('combobox');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(input);
  });

  it('keeps input prop getters stable across renders when nothing changed', () => {
    const { result, rerender } = renderHook(() =>
      useCombobox({ options: OPTIONS, presentation: 'popover', allowCreate: true }),
    );
    const input = result.current.getInputProps;
    const items = result.current.items;
    rerender();
    expect(result.current.getInputProps).toBe(input);
    expect(result.current.items).toBe(items);
  });
});

describe('useCombobox sheet props', () => {
  it('always types open and onOpenChange as set', () => {
    type Sheet = ReturnType<ReturnType<typeof useCombobox>['getSheetProps']>;
    expectTypeOf<Sheet['open']>().toEqualTypeOf<boolean>();
    expectTypeOf<Sheet['onOpenChange']>().toEqualTypeOf<NonNullable<BottomSheetRootProps['onOpenChange']>>();
  });
});

describe('useCombobox dialog presentation', () => {
  /** A palette whose input sits in a `<dialog>` that stays open while it closes, as Dialog does. */
  function DialogBox({
    onValueChange,
    onReady,
  }: {
    onValueChange?: (value: string | null) => void;
    onReady: (cb: UseComboboxResult) => void;
  }) {
    const [query, setQuery] = useState('');
    const cb = useCombobox({
      options: OPTIONS,
      presentation: 'dialog',
      value: null,
      onValueChange,
      inputValue: query,
      onInputValueChange: setQuery,
    });
    onReady(cb);
    return (
      <div>
        <button type="button" {...cb.getTriggerProps()}>
          Open
        </button>
        <button type="button">Elsewhere</button>
        <dialog open>
          <input {...cb.getInputProps()} />
        </dialog>
      </div>
    );
  }

  function renderDialogBox(onValueChange?: (value: string | null) => void) {
    let cb!: UseComboboxResult;
    render(<DialogBox onValueChange={onValueChange} onReady={(next) => (cb = next)} />);
    return () => cb;
  }

  function blur() {
    (document.activeElement as HTMLElement | null)?.blur();
  }

  it('turns off the popover and gives Dialog.Root its props', () => {
    const { result } = renderHook(() => useCombobox({ options: OPTIONS, presentation: 'dialog' }));
    expect(result.current.presentation).toBe('dialog');
    expect(result.current.isSheet).toBe(false);
    expect(result.current.getTriggerProps()['aria-haspopup']).toBe('dialog');
    const dialog = result.current.getDialogProps();
    expect(dialog.open).toBe(false);
    expect(dialog.initialFocusRef).toBe(result.current.inputRef);
    expect(dialog['aria-label']).toBe('Options');
    act(() => result.current.setOpen(true));
    expect(result.current.getDialogProps().open).toBe(true);
    act(() => result.current.getDialogProps().onOpenChange(false, 'backdrop'));
    expect(result.current.open).toBe(false);
  });

  it('does not open on input focus, and closes once on Escape from the input', () => {
    const onOpenChange = vi.fn();
    function Box() {
      const cb = useCombobox({ options: OPTIONS, presentation: 'dialog', onOpenChange });
      return <input {...cb.getInputProps()} />;
    }
    render(<Box />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    onOpenChange.mockClear();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
  });

  // A palette whose loads resolve only when a test settles their query.
  function asyncPalette(extra: Partial<UseComboboxSingleOptions> = {}) {
    const LISTS: Record<string, ComboboxOption[]> = {
      '': [
        { value: 'invoice', label: 'Create invoice' },
        { value: 'team', label: 'Invite team' },
        { value: 'billing', label: 'Open billing' },
      ],
      bill: [{ value: 'billing', label: 'Open billing' }],
    };
    // What the loader returns for '' once the loadKey is 'b'.
    const KEY_B: ComboboxOption[] = [
      { value: 'team', label: 'Invite team' },
      { value: 'invoice', label: 'Create invoice' },
    ];
    let loadKey: string = 'a';
    const pending = new Map<string, () => void>();
    const loadOptions = (query: string) => {
      const list = loadKey === 'b' && query === '' ? KEY_B : (LISTS[query] ?? []);
      return new Promise<readonly ComboboxOption[]>((resolve) => pending.set(query, () => resolve(list)));
    };
    const settle = async (query: string) => {
      await act(async () => {
        pending.get(query)?.();
        await Promise.resolve();
        await Promise.resolve();
      });
    };
    const hook = renderHook(() => useCombobox({ loadOptions, loadKey, presentation: 'dialog', value: null, ...extra }));
    const values = () => hook.result.current.items.map((item) => item.kind === 'option' && item.option.value);
    const setLoadKey = (next: string) => {
      loadKey = next;
      hook.rerender();
    };
    return { ...hook, settle, values, setLoadKey };
  }

  // Search 'bill', let it load, then close and reopen: the 'bill' list is still loaded.
  async function reopenAfterBill(palette: ReturnType<typeof asyncPalette>) {
    const { result, settle } = palette;
    await settle('');
    act(() => result.current.setOpen(true));
    act(() => result.current.setInputValue('bill'));
    await settle('bill');
    act(() => result.current.setOpen(false));
    act(() => result.current.setOpen(true));
  }

  it('offers create, and no other query\'s rows, after a failed load', async () => {
    const onCreate = vi.fn();
    const loadOptions = (query: string) =>
      query === 'NewTag' ? Promise.reject(new Error('down')) : Promise.resolve([{ value: 'a', label: 'Alpha' }]);
    const { result } = renderHook(() =>
      useCombobox({ loadOptions, allowCreate: true, onCreate, presentation: 'dialog', value: null }),
    );
    const flush = () =>
      act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    act(() => result.current.setOpen(true));
    await flush();
    act(() => result.current.setInputValue('NewTag'));
    await flush();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.items.map((item) => item.kind)).toEqual(['create']);
    const enter = { key: 'Enter', nativeEvent: { isComposing: false }, preventDefault: () => undefined };
    act(() => result.current.getInputProps().onKeyDown?.(enter as unknown as KeyboardEvent<HTMLInputElement>));
    expect(onCreate).toHaveBeenCalledWith('NewTag');
  });

  // A loader whose calls settle when the test says, newest last.
  function manualLoader() {
    const calls: { query: string; resolve: (list: readonly ComboboxOption[]) => void; reject: (error: Error) => void }[] =
      [];
    const loadOptions = vi.fn(
      (query: string) =>
        new Promise<readonly ComboboxOption[]>((resolve, reject) => calls.push({ query, resolve, reject })),
    );
    const last = () => calls[calls.length - 1]!;
    const settle = async (run: () => void) => {
      await act(async () => {
        run();
        await Promise.resolve();
        await Promise.resolve();
      });
    };
    return { calls, loadOptions, last, settle };
  }

  const enterKey = { key: 'Enter', nativeEvent: { isComposing: false }, preventDefault: () => undefined };
  function pressKey(result: { current: ReturnType<typeof useCombobox> }, key: string) {
    const event = { ...enterKey, key };
    act(() => result.current.getInputProps().onKeyDown?.(event as unknown as KeyboardEvent<HTMLInputElement>));
  }
  const pressEnter = (result: { current: ReturnType<typeof useCombobox> }) => pressKey(result, 'Enter');

  it('runs no create while a retry is in flight, and selects what the retry finds', async () => {
    const onCreate = vi.fn();
    const onValueChange = vi.fn();
    const { loadOptions, last, settle } = manualLoader();
    const { result } = renderHook(() =>
      useCombobox({ loadOptions, allowCreate: true, onCreate, onValueChange, presentation: 'dialog', value: null }),
    );
    act(() => result.current.setOpen(true));
    await settle(() => last().resolve([]));
    act(() => result.current.setInputValue('NewTag'));
    await settle(() => last().reject(new Error('down')));
    expect(result.current.showCreate).toBe(true);
    act(() => result.current.retry());
    expect(result.current.showCreate).toBe(false);
    expect(result.current.isEmpty).toBe(false);
    pressEnter(result);
    act(() => result.current.getChipInputProps().onCommit('NewTag'));
    expect(onCreate).not.toHaveBeenCalled();
    await settle(() => last().resolve([{ value: 'newtag', label: 'NewTag' }]));
    expect(result.current.showCreate).toBe(false);
    pressEnter(result);
    expect(onValueChange).toHaveBeenCalledWith('newtag');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('offers create again when a retry fails too', async () => {
    const { loadOptions, last, settle } = manualLoader();
    const { result } = renderHook(() =>
      useCombobox({ loadOptions, allowCreate: true, presentation: 'dialog', value: null }),
    );
    act(() => result.current.setOpen(true));
    await settle(() => last().resolve([]));
    act(() => result.current.setInputValue('NewTag'));
    await settle(() => last().reject(new Error('down')));
    act(() => result.current.retry());
    await settle(() => last().reject(new Error('still down')));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.showCreate).toBe(true);
  });

  it('waits for a reload of the same query, not only a retry', async () => {
    const { loadOptions, calls, settle } = manualLoader();
    const { result } = renderHook(() =>
      useCombobox({ loadOptions, allowCreate: true, presentation: 'dialog', value: null }),
    );
    act(() => result.current.setOpen(true));
    await settle(() => calls[0]!.resolve([]));
    act(() => result.current.setInputValue('ab'));
    await settle(() => calls[1]!.resolve([]));
    expect(result.current.showCreate).toBe(true);
    act(() => result.current.setInputValue('abc'));
    act(() => result.current.setInputValue('ab'));
    expect(result.current.showCreate).toBe(false);
    await settle(() => calls[calls.length - 1]!.resolve([]));
    expect(result.current.showCreate).toBe(true);
  });

  it('moves the highlight off a create row to no row until the new list is in', async () => {
    const onCreate = vi.fn();
    const onValueChange = vi.fn();
    const { loadOptions, last, settle } = manualLoader();
    const { result } = renderHook(() =>
      useCombobox({ loadOptions, allowCreate: true, onCreate, onValueChange, presentation: 'dialog', value: null }),
    );
    act(() => result.current.setOpen(true));
    await settle(() => last().resolve([]));
    act(() => result.current.setInputValue('Alp'));
    await settle(() => last().resolve([{ value: 'alpha', label: 'Alpha' }]));
    pressKey(result, 'End');
    expect(result.current.showCreate).toBe(true);
    // The create row, the last row, is active.
    expect(result.current.activeValue).not.toBe('alpha');
    expect(result.current.activeValue).not.toBeNull();
    act(() => result.current.setInputValue('Alph'));
    expect(result.current.activeValue).toBeNull();
    pressEnter(result);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
    await settle(() => last().resolve([{ value: 'alpha', label: 'Alpha' }]));
    expect(result.current.activeValue).toBe('alpha');
  });

  it('loads again on reset when the query stays the same', async () => {
    const { loadOptions, last, settle } = manualLoader();
    const { result } = renderHook(() =>
      useCombobox({ loadOptions, inputValue: 'Ab', allowCreate: true, presentation: 'popover', value: null }),
    );
    await settle(() => last().resolve([]));
    expect(result.current.showCreate).toBe(true);
    act(() => result.current.reset());
    expect(loadOptions).toHaveBeenCalledTimes(2);
    expect(result.current.showCreate).toBe(false);
    await settle(() => last().resolve([]));
    expect(result.current.showCreate).toBe(true);
  });

  it('is not empty while a load has failed', async () => {
    const { loadOptions, last, settle } = manualLoader();
    const { result } = renderHook(() => useCombobox({ loadOptions, presentation: 'popover', value: null }));
    await settle(() => last().reject(new Error('down')));
    expect(result.current.items).toEqual([]);
    expect(result.current.isEmpty).toBe(false);
  });

  it('runs no create while the list is still another query\'s', async () => {
    const onCreate = vi.fn();
    const onValueChange = vi.fn();
    const palette = asyncPalette({ allowCreate: true, onCreate, onValueChange });
    const { result, settle } = palette;
    await reopenAfterBill(palette);
    act(() => result.current.setInputValue('bi'));
    // The old 'bill' list, filtered, still shows 'Open billing'.
    const enter = { key: 'Enter', nativeEvent: { isComposing: false }, preventDefault: () => undefined };
    act(() => result.current.getInputProps().onKeyDown?.(enter as unknown as KeyboardEvent<HTMLInputElement>));
    act(() => result.current.getChipInputProps().onCommit('bi'));
    expect(onCreate).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
    // No create row either, as the old list cannot say whether 'bi' matches.
    expect(result.current.showCreate).toBe(false);
    expect(result.current.items.some((item) => item.kind === 'create')).toBe(false);
    await settle('bi');
    expect(result.current.showCreate).toBe(true);
    act(() => result.current.getInputProps().onKeyDown?.(enter as unknown as KeyboardEvent<HTMLInputElement>));
    expect(onCreate).toHaveBeenCalledWith('bi');
  });

  it('treats a list loaded for a NaN loadKey as current', async () => {
    let finish: (list: readonly ComboboxOption[]) => void = () => undefined;
    const loadOptions = () => new Promise<readonly ComboboxOption[]>((resolve) => (finish = resolve));
    const { result } = renderHook(() =>
      useCombobox({ loadOptions, loadKey: Number.NaN, presentation: 'dialog', value: null }),
    );
    act(() => result.current.setOpen(true));
    await act(async () => {
      finish([{ value: 'a', label: 'Alpha' }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.activeValue).toBe('a');
  });

  it('waits for the list of a new loadKey before picking a row', async () => {
    const palette = asyncPalette();
    const { result, settle, setLoadKey } = palette;
    await settle('');
    act(() => result.current.setOpen(true));
    act(() => result.current.setOpen(false));
    setLoadKey('b');
    act(() => result.current.setOpen(true));
    expect(result.current.activeValue).toBeNull();
    expect(result.current.getInputProps()['aria-activedescendant']).toBeUndefined();
    await settle('');
    expect(palette.values()).toEqual(['team', 'invoice']);
    expect(result.current.activeValue).toBe('team');
  });

  it('highlights the top row of the full list once it loads, not the last query\'s', async () => {
    const { result, settle, values } = asyncPalette();
    await settle('');
    act(() => result.current.setOpen(true));
    act(() => result.current.setInputValue('bill'));
    await settle('bill');
    expect(result.current.activeValue).toBe('billing');
    act(() => result.current.setOpen(false));
    act(() => result.current.setOpen(true));
    expect(result.current.inputValue).toBe('');
    // The old query's list is still on screen: no row is active, so Enter runs nothing.
    expect(result.current.activeValue).toBeNull();
    expect(result.current.getInputProps()['aria-activedescendant']).toBeUndefined();
    await settle('');
    expect(values()).toEqual(['invoice', 'team', 'billing']);
    expect(result.current.activeValue).toBe('invoice');
  });

  it('waits for the full list after a reopen even when the query was cleared before closing', async () => {
    const { result, settle, values } = asyncPalette();
    await settle('');
    act(() => result.current.setOpen(true));
    act(() => result.current.setInputValue('bill'));
    await settle('bill');
    // Cleared, then closed and reopened before the full list's load lands.
    act(() => result.current.setInputValue(''));
    act(() => result.current.setOpen(false));
    act(() => result.current.setOpen(true));
    expect(result.current.activeValue).toBeNull();
    await settle('');
    expect(values()).toEqual(['invoice', 'team', 'billing']);
    expect(result.current.activeValue).toBe('invoice');
  });

  it('keeps a row picked while the full list loads', async () => {
    const { result, settle } = asyncPalette();
    await settle('');
    act(() => result.current.setOpen(true));
    act(() => result.current.setInputValue('bill'));
    await settle('bill');
    act(() => result.current.setOpen(false));
    act(() => result.current.setOpen(true));
    act(() => result.current.highlight('billing'));
    await settle('');
    expect(result.current.activeValue).toBe('billing');
  });

  it('keeps setOpen the same function as the query changes', async () => {
    const { result, settle } = asyncPalette();
    await settle('');
    const setOpen = result.current.setOpen;
    act(() => result.current.setInputValue('bill'));
    expect(result.current.setOpen).toBe(setOpen);
  });

  it('runs a selection only while open, so a closing dialog cannot run it twice', () => {
    const onValueChange = vi.fn();
    const onCreate = vi.fn();
    const { result } = renderHook(() =>
      useCombobox({ options: OPTIONS, presentation: 'dialog', value: null, onValueChange, allowCreate: true, onCreate }),
    );
    act(() => result.current.setOpen(true));
    act(() => result.current.select('redux'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe(false);
    act(() => result.current.select('redux'));
    act(() => result.current.select('vue'));
    expect(onValueChange).toHaveBeenCalledTimes(1);

    act(() => result.current.setInputValue('Angular'));
    act(() => result.current.create());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('ignores Enter in the input while it closes', () => {
    const onValueChange = vi.fn();
    const cb = renderDialogBox(onValueChange);
    act(() => cb().setOpen(true));
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('react');
  });

  it('clears a controlled query and highlights the top row each time it opens', () => {
    const cb = renderDialogBox();
    act(() => cb().setOpen(true));
    act(() => cb().setInputValue('v'));
    act(() => cb().setOpen(false));
    expect(cb().inputValue).toBe('v');
    act(() => cb().setInputValue('r'));
    act(() => cb().highlight('redux'));
    expect(cb().activeValue).toBe('redux');
    blur();
    act(() => cb().setOpen(true));
    expect(cb().inputValue).toBe('');
    expect(cb().activeValue).toBe('react');
    expect(screen.getByRole<HTMLInputElement>('combobox').value).toBe('');
  });

  it('keeps the query when reopened while still closing with focus inside', () => {
    const cb = renderDialogBox();
    act(() => cb().setOpen(true));
    act(() => cb().setInputValue('vu'));
    screen.getByRole('combobox').focus();
    act(() => cb().setOpen(false));
    act(() => cb().setOpen(true));
    expect(cb().inputValue).toBe('vu');
  });

  it('keeps the query when asked to open while already open', () => {
    const cb = renderDialogBox();
    act(() => cb().setOpen(true));
    act(() => cb().setInputValue('vu'));
    blur();
    act(() => cb().setOpen(true));
    expect(cb().inputValue).toBe('vu');
  });

  it('returns focus to the trigger only when nothing had focus at open', () => {
    const cb = renderDialogBox();
    blur();
    act(() => cb().setOpen(true));
    expect(cb().getDialogProps().restoreFocusRef?.current).toBe(screen.getByRole('button', { name: 'Open' }));
    act(() => cb().setOpen(false));

    screen.getByRole('button', { name: 'Elsewhere' }).focus();
    act(() => cb().setOpen(true));
    expect(cb().getDialogProps().restoreFocusRef?.current).toBeNull();
  });

  it('always types open and onOpenChange as set', () => {
    type DialogProps = ReturnType<UseComboboxResult['getDialogProps']>;
    expectTypeOf<DialogProps['open']>().toEqualTypeOf<boolean>();
    expectTypeOf<DialogProps['onOpenChange']>().toEqualTypeOf<NonNullable<DialogRootProps['onOpenChange']>>();
    expectTypeOf<UseComboboxResult['presentation']>().toEqualTypeOf<'popover' | 'sheet' | 'dialog'>();
  });
});

describe('useCombobox overlay names', () => {
  it('names the sheet and the dialog from the strings', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StringsProvider strings={{ options: 'Choix' }}>{children}</StringsProvider>
    );
    const { result } = renderHook(() => useCombobox({ options: OPTIONS, presentation: 'dialog' }), { wrapper });
    expect(result.current.getDialogProps()['aria-label']).toBe('Choix');
    expect(result.current.getSheetProps()['aria-label']).toBe('Choix');
  });
});

describe('useCombobox async create', () => {
  function deferredCreate() {
    const calls: { resolve: (value: string) => void; reject: (reason: unknown) => void }[] = [];
    const onCreate = vi.fn(
      () =>
        new Promise<string>((resolve, reject) => {
          calls.push({ resolve, reject });
        }),
    );
    return { onCreate, calls };
  }

  function multiCreate(onCreate: (label: string) => Promise<string>, onValueChange?: (value: string[]) => void) {
    return renderHook(() =>
      useCombobox({
        selectionMode: 'multiple',
        options: OPTIONS,
        allowCreate: true,
        presentation: 'popover',
        defaultOpen: true,
        onCreate,
        onValueChange,
      }),
    );
  }

  function singleCreate(onCreate: (label: string) => Promise<string>, extra: Partial<UseComboboxSingleOptions> = {}) {
    return renderHook(() =>
      useCombobox({
        options: OPTIONS,
        allowCreate: true,
        presentation: 'popover',
        defaultOpen: true,
        onCreate,
        ...extra,
      }),
    );
  }

  function type(result: { current: UseComboboxResult }, text: string) {
    act(() =>
      result.current.getInputProps().onChange?.({ target: { value: text } } as never),
    );
  }

  it('runs onCreate once while its promise is pending, and reports creating', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = multiCreate(onCreate);
    act(() => result.current.setInputValue('new'));
    act(() => result.current.create());
    act(() => result.current.create());
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(result.current.creating).toBe(true);
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toEqual(['new']);
    expect(result.current.creating).toBe(false);
  });

  it('keeps a selection made while a multiple create is pending', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = multiCreate(onCreate);
    act(() => result.current.setInputValue('new'));
    act(() => result.current.create());
    act(() => result.current.select('react'));
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toEqual(['react', 'new']);
  });

  it('keeps text typed while a multiple create is pending', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = multiCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    type(result, 'next');
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toEqual(['new']);
    expect(result.current.inputValue).toBe('next');
  });

  it('drops a multiple create that resolves after clear', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = multiCreate(onCreate);
    act(() => result.current.setInputValue('new'));
    act(() => result.current.create());
    act(() => result.current.clear());
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toEqual([]);
    expect(result.current.creating).toBe(false);
  });

  it('drops a single create that resolves after another pick', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = singleCreate(onCreate);
    act(() => result.current.setInputValue('new'));
    act(() => result.current.create());
    act(() => result.current.select('vue'));
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toBe('vue');
    expect(result.current.inputValue).toBe('Vue');
    expect(result.current.creating).toBe(false);
  });

  it('drops a single create that resolves after clear', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = singleCreate(onCreate);
    act(() => result.current.setInputValue('new'));
    act(() => result.current.create());
    act(() => result.current.clear());
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toBeNull();
    expect(result.current.inputValue).toBe('');
  });

  it('drops a single create that resolves after the user types', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = singleCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    type(result, 'other');
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toBeNull();
    expect(result.current.inputValue).toBe('other');
  });

  it('drops a create that resolves after reset', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = singleCreate(onCreate, { defaultValue: 'react' });
    act(() => result.current.setInputValue('new'));
    act(() => result.current.create());
    act(() => result.current.reset());
    expect(result.current.creating).toBe(false);
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toBe('react');
    expect(result.current.inputValue).toBe('React');
  });

  it('drops a create that resolves after unmount', async () => {
    const { onCreate, calls } = deferredCreate();
    const onValueChange = vi.fn();
    const { result, unmount } = singleCreate(onCreate, { onValueChange });
    act(() => result.current.setInputValue('new'));
    act(() => result.current.create());
    unmount();
    await act(async () => calls[0]?.resolve('new'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('reports a rejected create in createError, not error, and lets the user try again', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = multiCreate(onCreate);
    const failure = new Error('taken');
    act(() => result.current.setInputValue('new'));
    act(() => result.current.create());
    await act(async () => calls[0]?.reject(failure));
    expect(result.current.createError).toBe(failure);
    expect(result.current.error).toBeNull();
    expect(result.current.creating).toBe(false);
    expect(result.current.value).toEqual([]);
    act(() => result.current.create());
    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(result.current.createError).toBeNull();
  });

  it('clears createError on the next input change', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = multiCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    await act(async () => calls[0]?.reject(new Error('taken')));
    expect(result.current.createError).not.toBeNull();
    type(result, 'newer');
    expect(result.current.createError).toBeNull();
  });

  it('leaves a throw from onValueChange after a create to the consumer, not createError', async () => {
    const { onCreate, calls } = deferredCreate();
    const failure = new Error('rejected by the store');
    const onInputValueChange = vi.fn();
    const { result } = renderHook(() =>
      useCombobox({
        selectionMode: 'multiple',
        options: OPTIONS,
        allowCreate: true,
        presentation: 'popover',
        defaultOpen: true,
        onCreate,
        onInputValueChange,
        onValueChange: () => {
          throw failure;
        },
      }),
    );
    act(() => result.current.setInputValue('new'));
    act(() => result.current.create());
    const unhandled = await captureUnhandled(() => act(async () => calls[0]?.resolve('new')));
    expect(unhandled).toEqual([failure]);
    expect(result.current.createError).toBeNull();
    expect(result.current.value).toEqual(['new']);
    expect(onInputValueChange).toHaveBeenLastCalledWith('');
    expect(result.current.creating).toBe(false);
  });

  it('runs a create for another label while one is pending in multiple mode', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = multiCreate(onCreate);
    type(result, 'a');
    act(() => result.current.create());
    type(result, 'b');
    act(() => result.current.create());
    expect(onCreate).toHaveBeenCalledTimes(2);
    await act(async () => calls[1]?.resolve('b'));
    expect(result.current.creating).toBe(true);
    await act(async () => calls[0]?.resolve('a'));
    expect(result.current.value).toEqual(['b', 'a']);
    expect(result.current.creating).toBe(false);
  });

  it('keeps the create row of a pending label active but disabled, and Enter does not run it again', async () => {
    const { onCreate } = deferredCreate();
    const { result } = multiCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    const row = result.current.items.find((item) => item.kind === 'create');
    expect(row && result.current.getOptionProps(row)['aria-disabled']).toBe(true);
    expect(result.current.activeId).toBe(row?.id);
    let handled = false;
    act(() => {
      handled = result.current.getChipInputProps().onCommit('new') !== false;
    });
    expect(handled).toBe(true);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('drops a single create that resolves after Escape clears the text of a closed list', async () => {
    const { onCreate, calls } = deferredCreate();
    const onOpenChange = vi.fn();
    const { result } = singleCreate(onCreate, { onOpenChange });
    type(result, 'new');
    act(() => result.current.create());
    act(() => result.current.setOpen(false, 'escape'));
    act(() => result.current.getInputProps().onKeyDown?.({ key: 'Escape', preventDefault() {} } as never));
    onOpenChange.mockClear();
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toBeNull();
    expect(result.current.inputValue).toBe('');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('drops a single create that resolves after the consumer sets other text', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = singleCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    act(() => result.current.setInputValue(''));
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toBeNull();
    expect(result.current.inputValue).toBe('');
  });

  it('commits a single create after Escape closes the list, without closing it again', async () => {
    const { onCreate, calls } = deferredCreate();
    const onOpenChange = vi.fn();
    const { result } = singleCreate(onCreate, { onOpenChange });
    type(result, 'new');
    act(() => result.current.create());
    act(() => result.current.setOpen(false, 'escape'));
    onOpenChange.mockClear();
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toBe('new');
    expect(result.current.inputValue).toBe('new');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('applies a single create in full when onValueChange throws, and runs the other callbacks', async () => {
    const { onCreate, calls } = deferredCreate();
    const failure = new Error('rejected by the store');
    const onInputValueChange = vi.fn();
    const onOpenChange = vi.fn();
    const { result } = singleCreate(onCreate, {
      onInputValueChange,
      onOpenChange,
      onValueChange: () => {
        throw failure;
      },
    });
    type(result, 'new');
    act(() => result.current.create());
    const unhandled = await captureUnhandled(() => act(async () => calls[0]?.resolve('new')));
    expect(unhandled).toEqual([failure]);
    expect(result.current.createError).toBeNull();
    expect(onInputValueChange).toHaveBeenLastCalledWith('new');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'select');
    expect(result.current.value).toBe('new');
    expect(result.current.inputValue).toBe('new');
    expect(result.current.open).toBe(false);
    expect(result.current.creating).toBe(false);
  });

  it.each([
    ['a pick', (cb: UseComboboxResult) => cb.select('react')],
    ['a removed chip', (cb: UseComboboxResult) => cb.remove('vue')],
    ['clear()', (cb: UseComboboxResult) => cb.clear()],
  ])('clears createError on %s', async (_name, act_) => {
    const { onCreate, calls } = deferredCreate();
    const { result } = renderHook(() =>
      useCombobox({
        selectionMode: 'multiple',
        options: OPTIONS,
        allowCreate: true,
        presentation: 'popover',
        defaultOpen: true,
        defaultValue: ['vue'],
        onCreate,
      }),
    );
    type(result, 'new');
    act(() => result.current.create());
    await act(async () => calls[0]?.reject(new Error('taken')));
    expect(result.current.createError).not.toBeNull();
    act(() => act_(result.current));
    expect(result.current.createError).toBeNull();
  });

  it('clears createError when the list opens', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = multiCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    await act(async () => calls[0]?.reject(new Error('taken')));
    act(() => result.current.setOpen(false));
    expect(result.current.createError).not.toBeNull();
    act(() => result.current.setOpen(true));
    expect(result.current.createError).toBeNull();
  });

  it('keeps both chips when two creates settle in the same tick', async () => {
    const { onCreate, calls } = deferredCreate();
    const onValueChange = vi.fn();
    const { result } = multiCreate(onCreate, onValueChange);
    act(() => result.current.setInputValue('a'));
    act(() => result.current.create());
    act(() => result.current.setInputValue('b'));
    act(() => result.current.create());
    expect(calls).toHaveLength(2);
    await act(async () => {
      calls[0]?.resolve('a');
      calls[1]?.resolve('b');
    });
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([['a'], ['a', 'b']]);
    expect(result.current.value).toEqual(['a', 'b']);
  });

  it('keeps both chips of a controlled owner when two creates settle in the same tick', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = renderHook(() => {
      const [value, setValue] = useState<string[]>([]);
      return useCombobox({
        selectionMode: 'multiple',
        options: OPTIONS,
        allowCreate: true,
        presentation: 'popover',
        defaultOpen: true,
        value,
        onValueChange: setValue,
        onCreate,
      });
    });
    type(result, 'a');
    act(() => result.current.create());
    type(result, 'b');
    act(() => result.current.create());
    await act(async () => {
      calls[0]?.resolve('a');
      calls[1]?.resolve('b');
    });
    expect(result.current.value).toEqual(['a', 'b']);
  });

  it('reports a synchronous throw from onCreate in createError, like a rejection', () => {
    const failure = new Error('taken');
    const { result } = singleCreate(() => {
      throw failure;
    });
    type(result, 'new');
    expect(() => act(() => result.current.create())).not.toThrow();
    expect(result.current.createError).toBe(failure);
    expect(result.current.creating).toBe(false);
  });

  it('throws a consumer callback\'s error out of a pick after running every callback', () => {
    const failure = new Error('rejected by the store');
    const onInputValueChange = vi.fn();
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        presentation: 'popover',
        defaultOpen: true,
        onInputValueChange,
        onOpenChange,
        onValueChange: () => {
          throw failure;
        },
      }),
    );
    let thrown: unknown = null;
    act(() => {
      try {
        result.current.select('react');
      } catch (error) {
        thrown = error;
      }
    });
    expect(thrown).toBe(failure);
    expect(onInputValueChange).toHaveBeenCalledWith('React');
    expect(onOpenChange).toHaveBeenCalledWith(false, 'select');
    expect(result.current.value).toBe('react');
    expect(result.current.open).toBe(false);
  });

  it.each(['single', 'multiple'] as const)('reports no createError for a %s create that fails after a pick', async (mode) => {
    const { onCreate, calls } = deferredCreate();
    const { result } = mode === 'single' ? singleCreate(onCreate) : multiCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    act(() => result.current.select('react'));
    await act(async () => calls[0]?.reject(new Error('taken')));
    expect(result.current.createError).toBeNull();
  });

  it('takes back a single create dropped by a pick when its label runs again, without a second onCreate', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = singleCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    act(() => result.current.select('react'));
    act(() => result.current.setOpen(true));
    type(result, 'new');
    const row = result.current.items.find((item) => item.kind === 'create');
    expect(row && result.current.getOptionProps(row)['aria-disabled']).toBeUndefined();
    expect(result.current.creating).toBe(false);
    let handled = false;
    act(() => {
      handled = result.current.getChipInputProps().onCommit('new') !== false;
    });
    expect(handled).toBe(true);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(result.current.creating).toBe(true);
    await act(async () => calls[0]?.resolve('new-1'));
    expect(result.current.value).toBe('new-1');
    expect(result.current.creating).toBe(false);
  });

  it('takes back a multiple create dropped by clear when its label runs again', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = multiCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    act(() => result.current.clear());
    expect(result.current.creating).toBe(false);
    type(result, 'new');
    act(() => result.current.create());
    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toEqual(['new']);
  });

  it.each([
    ['reset()', (cb: UseComboboxResult) => cb.reset()],
    ['clear()', (cb: UseComboboxResult) => cb.clear()],
    ['a pick', (cb: UseComboboxResult) => cb.select('react')],
  ])('stops reporting a single create as creating at once after %s', (_name, act_) => {
    const { onCreate } = deferredCreate();
    const { result } = singleCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    expect(result.current.creating).toBe(true);
    act(() => act_(result.current));
    expect(result.current.creating).toBe(false);
  });

  it('commits a single create when the text reads its label again before it settles', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = singleCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    type(result, 'newer');
    type(result, 'new');
    act(() => result.current.create());
    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toBe('new');
  });

  it('runs a label once while a create dropped by reset is still pending, and commits it when run again', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = singleCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    act(() => result.current.reset());
    act(() => result.current.setOpen(true));
    type(result, 'new');
    act(() => result.current.create());
    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toBe('new');
  });

  it('keeps a single create stale once the value changed, even when the text and value come back', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = singleCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    act(() => result.current.select('react'));
    act(() => result.current.remove('react'));
    type(result, 'new');
    expect(result.current.creating).toBe(false);
    await act(async () => calls[0]?.resolve('new'));
    expect(result.current.value).toBeNull();
  });

  it('treats a pending label as pending whatever its case', () => {
    const { onCreate } = deferredCreate();
    const { result } = multiCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    type(result, 'New');
    act(() => result.current.create());
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('clears createError when the consumer sets the text', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result } = multiCreate(onCreate);
    type(result, 'new');
    act(() => result.current.create());
    await act(async () => calls[0]?.reject(new Error('taken')));
    expect(result.current.createError).not.toBeNull();
    act(() => result.current.setInputValue('other'));
    expect(result.current.createError).toBeNull();
  });

  it('clears createError when a controlled inputValue changes', async () => {
    const { onCreate, calls } = deferredCreate();
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) =>
        useCombobox({
          options: OPTIONS,
          allowCreate: true,
          presentation: 'popover',
          defaultOpen: true,
          inputValue: text,
          onCreate,
        }),
      { initialProps: { text: 'new' } },
    );
    act(() => result.current.create());
    await act(async () => calls[0]?.reject(new Error('taken')));
    expect(result.current.createError).not.toBeNull();
    rerender({ text: 'other' });
    expect(result.current.createError).toBeNull();
  });

  it('runs onCreate once across an Activity hiding and showing the combobox', async () => {
    const { onCreate, calls } = deferredCreate();
    let cb!: UseComboboxResult;
    function Probe() {
      cb = useCombobox({ options: OPTIONS, allowCreate: true, presentation: 'popover', defaultOpen: true, onCreate });
      return null;
    }
    const { rerender } = render(
      <Activity mode="visible">
        <Probe />
      </Activity>,
    );
    act(() => cb.setInputValue('new'));
    act(() => cb.create());
    expect(cb.creating).toBe(true);
    rerender(
      <Activity mode="hidden">
        <Probe />
      </Activity>,
    );
    rerender(
      <Activity mode="visible">
        <Probe />
      </Activity>,
    );
    expect(cb.creating).toBe(false);
    act(() => cb.create());
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(cb.creating).toBe(true);
    await act(async () => calls[0]?.resolve('new'));
    expect(cb.value).toBe('new');
    expect(cb.creating).toBe(false);
  });

  it('leaves a load error showing while a create runs', async () => {
    const onCreate = vi.fn(() => new Promise<string>(() => undefined));
    const { result } = renderHook(() =>
      useCombobox({
        loadOptions: () => Promise.reject(new Error('offline')),
        allowCreate: true,
        presentation: 'popover',
        defaultOpen: true,
        defaultInputValue: 'new',
        onCreate,
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.error).toBeInstanceOf(Error);
    act(() => result.current.create());
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useCombobox keys', () => {
  function CityBox({ onValueChange, onCreate }: { onValueChange: (value: string | null) => void; onCreate: (label: string) => Promise<string> }) {
    const cb = useCombobox({
      options: [
        { value: 'newton', label: 'Newton' },
        { value: 'newark', label: 'Newark' },
      ],
      allowCreate: true,
      presentation: 'popover',
      defaultOpen: true,
      onValueChange,
      onCreate,
    });
    return (
      <div>
        <label {...cb.getLabelProps()}>City</label>
        <Field.Root {...cb.getAnchorProps()}>
          <Field.TextInput {...cb.getInputProps()} />
        </Field.Root>
        <Popover.Root {...cb.getPopoverProps()}>
          <OptionList.Root {...cb.getListboxProps()}>
            {cb.items.map((item) => (
              <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
            ))}
          </OptionList.Root>
        </Popover.Root>
      </div>
    );
  }

  it('holds a second Enter on a pending create row instead of picking an option', () => {
    const onValueChange = vi.fn();
    const onCreate = vi.fn(() => new Promise<string>(() => undefined));
    render(<CityBox onValueChange={onValueChange} onCreate={onCreate} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.keyDown(input, { key: 'End' });
    const createId = input.getAttribute('aria-activedescendant');
    expect(createId).toContain('create');
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(input.getAttribute('aria-activedescendant')).toBe(createId);
    const row = document.getElementById(createId!);
    expect(row?.getAttribute('aria-disabled')).toBe('true');
    expect(row?.hasAttribute('data-highlighted')).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).not.toBe(createId);
  });

  it('moves on an ArrowDown with keyCode 229 outside a composition', () => {
    render(<SingleBox defaultOpen />);
    const input = screen.getByRole('combobox');
    expect(input.getAttribute('aria-activedescendant')).toBe(optionDomId(input.getAttribute('aria-controls')!, 'react'));
    expect(fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 229 })).toBe(false);
    expect(input.getAttribute('aria-activedescendant')).toBe(optionDomId(input.getAttribute('aria-controls')!, 'redux'));
  });

  it('leaves the Enter that ends an IME composition in Safari to the input', () => {
    const onChange = vi.fn();
    render(<SingleBox defaultOpen onValueChange={onChange} />);
    expect(fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter', keyCode: 229 })).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves Enter to the form while a single list is closed', () => {
    const onChange = vi.fn();
    render(<SingleBox onValueChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves Enter to the form on an open list with no row and no create row', () => {
    render(<SingleBox defaultOpen />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true);
  });

  it('does not toggle the last highlighted option with Enter while a multiple list is closed', () => {
    const onChange = vi.fn();
    render(<MultiCreateBox onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 're' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  function CommaBox({ onChange }: { onChange: (value: string[]) => void }) {
    const cb = useCombobox({ selectionMode: 'multiple', options: OPTIONS, presentation: 'popover', onValueChange: onChange });
    return (
      <div>
        <label {...cb.getLabelProps()}>Field</label>
        <Field.Root {...cb.getAnchorProps()}>
          <Field.ChipInput {...cb.getChipInputProps()} commitKeys={['Enter', ',']} />
        </Field.Root>
        <Popover.Root {...cb.getPopoverProps()}>
          <OptionList.Root {...cb.getListboxProps()}>
            {cb.items.map((item) => (
              <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
            ))}
          </OptionList.Root>
        </Popover.Root>
      </div>
    );
  }

  it('keeps a comma from being typed while a chip list is closed, and commits the active row with it while open', () => {
    const onChange = vi.fn();
    render(<CommaBox onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 're' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(fireEvent.keyDown(input, { key: ',' })).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(fireEvent.keyDown(input, { key: ',' })).toBe(false);
    expect(onChange).toHaveBeenCalledWith(['react']);
  });
});

describe('useCombobox reset', () => {
  it('goes through the change callbacks, so a controlled combobox resets', () => {
    const onValueChange = vi.fn();
    const onInputValueChange = vi.fn();
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        presentation: 'popover',
        value: 'react',
        inputValue: 'React',
        open: true,
        onValueChange,
        onInputValueChange,
        onOpenChange,
      }),
    );
    act(() => result.current.reset());
    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(onInputValueChange).toHaveBeenCalledWith('');
    expect(onOpenChange).toHaveBeenCalledWith(false, 'reset');
  });

  it('calls no change callback for a value reset leaves as it was', () => {
    const onValueChange = vi.fn();
    const onInputValueChange = vi.fn();
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        presentation: 'popover',
        defaultValue: 'react',
        onValueChange,
        onInputValueChange,
        onOpenChange,
      }),
    );
    act(() => result.current.setOpen(true));
    onOpenChange.mockClear();
    act(() => result.current.reset());
    expect(onOpenChange).toHaveBeenCalledWith(false, 'reset');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onInputValueChange).not.toHaveBeenCalled();
  });

  it('reopens a dialog with defaultOpen at its default text, without clearing it first', () => {
    const onInputValueChange = vi.fn();
    const { result } = renderHook(() =>
      useCombobox({
        options: OPTIONS,
        presentation: 'dialog',
        defaultOpen: true,
        defaultInputValue: 'Re',
        onInputValueChange,
      }),
    );
    act(() => result.current.setOpen(false));
    act(() => result.current.reset());
    expect(result.current.open).toBe(true);
    expect(result.current.inputValue).toBe('Re');
    expect(onInputValueChange).not.toHaveBeenCalled();
  });

  it('resets a controlled multiple value through onValueChange', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(() =>
      useCombobox({
        selectionMode: 'multiple',
        options: OPTIONS,
        presentation: 'popover',
        value: ['react'],
        onValueChange,
      }),
    );
    act(() => result.current.reset());
    expect(onValueChange).toHaveBeenCalledWith([]);
  });
});

describe('useCombobox trigger props', () => {
  function SheetTrigger({ onOpenChange }: { onOpenChange: () => void }) {
    const ref = useRef<HTMLButtonElement | null>(null);
    const cb = useCombobox({ options: OPTIONS, presentation: 'sheet', onOpenChange });
    return (
      <Button.Root
        {...cb.getTriggerProps({ ref, onClick: (event) => event.preventDefault() })}
        data-same-ref={String(ref.current !== null && ref.current === cb.triggerRef.current)}
      >
        Pick
      </Button.Root>
    );
  }

  it('skips the toggle when the caller prevents the click, and keeps the caller ref', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<SheetTrigger onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
    expect(onOpenChange).not.toHaveBeenCalled();
    rerender(<SheetTrigger onOpenChange={onOpenChange} />);
    expect(screen.getByRole('button', { name: 'Pick' }).getAttribute('data-same-ref')).toBe('true');
  });
});

describe('useCombobox listbox name', () => {
  it('points the label at the input in a popover and at the trigger in a sheet', () => {
    const popover = renderHook(() => useCombobox({ options: OPTIONS, presentation: 'popover' })).result.current;
    expect(popover.getLabelProps()).toEqual({ id: popover.ids.label, htmlFor: popover.ids.input });
    const sheet = renderHook(() => useCombobox({ options: OPTIONS, presentation: 'sheet' })).result.current;
    expect(sheet.getLabelProps()).toEqual({ id: sheet.ids.label, htmlFor: sheet.ids.trigger });
  });

  it('names the listbox by the label unless the caller names it', () => {
    const { result } = renderHook(() => useCombobox({ options: OPTIONS, presentation: 'popover' }));
    expect(result.current.getListboxProps()['aria-labelledby']).toBe(result.current.ids.label);
    const named = result.current.getListboxProps({ 'aria-label': 'Commands' });
    expect(named['aria-label']).toBe('Commands');
    expect(named['aria-labelledby']).toBeUndefined();
    expect(result.current.getListboxProps({ 'aria-labelledby': 'heading' })['aria-labelledby']).toBe('heading');
  });

  it('warns in development when the open list has no name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      function Unnamed() {
        const cb = useCombobox({ options: OPTIONS, presentation: 'popover', defaultOpen: true });
        return (
          <div>
            <Field.Root {...cb.getAnchorProps()}>
              <Field.TextInput {...cb.getInputProps()} />
            </Field.Root>
            <Popover.Root {...cb.getPopoverProps()}>
              <OptionList.Root {...cb.getListboxProps()}>{null}</OptionList.Root>
            </Popover.Root>
          </div>
        );
      }
      render(<Unnamed />);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('listbox has no name'));
      warn.mockClear();
      cleanup();
      function Named() {
        const cb = useCombobox({ options: OPTIONS, presentation: 'popover', defaultOpen: true });
        return (
          <div>
            <label {...cb.getLabelProps()}>Framework</label>
            <Field.Root {...cb.getAnchorProps()}>
              <Field.TextInput {...cb.getInputProps()} />
            </Field.Root>
            <Popover.Root {...cb.getPopoverProps()}>
              <OptionList.Root {...cb.getListboxProps()}>{null}</OptionList.Root>
            </Popover.Root>
          </div>
        );
      }
      render(<Named />);
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('listbox has no name'));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('useCombobox controlled owner that turns a change down', () => {
  it('asks again on every ArrowDown while open stays false', () => {
    const onOpenChange = vi.fn();
    render(<SingleBox open={false} onOpenChange={onOpenChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onOpenChange.mock.calls).toEqual([
      [true, 'trigger'],
      [true, 'trigger'],
    ]);
  });

  it('builds the next change on the value it rendered, not on a value it turned down', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(() =>
      useCombobox({
        selectionMode: 'multiple',
        options: OPTIONS,
        presentation: 'popover',
        value: ['react', 'redux', 'vue'],
        onValueChange,
      }),
    );
    act(() => result.current.select('x'));
    act(() => result.current.select('x'));
    act(() => result.current.remove('react'));
    expect(onValueChange.mock.calls).toEqual([
      [['react', 'redux', 'vue', 'x']],
      [['react', 'redux', 'vue', 'x']],
      [['redux', 'vue']],
    ]);
  });
});
