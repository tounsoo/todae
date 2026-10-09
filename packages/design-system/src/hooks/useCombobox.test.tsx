import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Field } from '../components/Field';
import { OptionList } from '../components/OptionList';
import { Popover } from '../components/Popover';
import { optionDomId } from '../components/OptionList.ids';
import { resetMatchMedia, setMatchMedia } from '../test/setup';
import * as api from '../index';
import type { BottomSheetRootProps } from '../components/BottomSheet';
import type { DialogRootProps } from '../components/Dialog';
import { useState } from 'react';
import {
  useCombobox,
  type ComboboxOption,
  type UseComboboxResult,
  type UseComboboxSingleOptions,
} from './useCombobox';

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
