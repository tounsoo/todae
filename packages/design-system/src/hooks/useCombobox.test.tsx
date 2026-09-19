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
      <Popover {...cb.getPopoverProps()}>
        <Popover.Content aria-label="Options">
          <OptionList {...cb.getListboxProps()}>
            {cb.items.map((item) => (
              <Option key={item.id} {...cb.getOptionProps(item)} />
            ))}
          </OptionList>
        </Popover.Content>
      </Popover>
    </div>
  );
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
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
    onOpenChange.mockClear();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onOpenChange).toHaveBeenCalledWith(false, 'blur');
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
