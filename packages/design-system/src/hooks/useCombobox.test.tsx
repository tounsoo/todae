import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from '../components/Field';
import { Option, OptionList } from '../components/OptionList';
import { Popover } from '../components/Popover';
import { optionDomId } from '../components/OptionList.ids';
import { resetMatchMedia, setMatchMedia } from '../test/setup';
import * as api from '../index';
import { useCombobox, type ComboboxOption, type UseComboboxSingleOptions } from './useCombobox';

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
      <Popover {...cb.getPopoverProps()} aria-label="Options">
        <OptionList {...cb.getListboxProps()}>
          {cb.items.map((item) => (
            <Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList>
      </Popover>
    </div>
  );
}

function MultiCreateBox({ onChange }: { onChange?: (value: string[]) => void } = {}) {
  const cb = useCombobox({
    selectionMode: 'multiple',
    options: OPTIONS,
    allowCreate: true,
    presentation: 'popover',
    onChange,
  });
  return (
    <div>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.ChipInput {...cb.getChipInputProps()} />
      </Field.Root>
      <Popover {...cb.getPopoverProps()} aria-label="Options">
        <OptionList {...cb.getListboxProps()}>
          {cb.items.map((item) => (
            <Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList>
      </Popover>
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
    render(<SingleBox onChange={onChange} onOpenChange={onOpenChange} />);
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
    render(<SingleBox defaultValue="react" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('keeps controlled open and value on the caller', () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<SingleBox open={false} value="react" onChange={onChange} onOpenChange={onOpenChange} />);
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
        onChange,
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

  it('commits a create row from click in the same turn and closes single mode', () => {
    const onChange = vi.fn();
    render(<SingleBox allowCreate onChange={onChange} />);
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
        onChange,
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
});
