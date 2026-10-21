import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkbox } from '../components/Checkbox.js';
import { useSelection, type UseSelectionOptions } from './useSelection.js';

afterEach(cleanup);

const KEYS = ['a', 'b', 'c', 'd', 'e'];

function setup(options: Partial<UseSelectionOptions<string>> = {}) {
  return renderHook((props: Partial<UseSelectionOptions<string>>) => useSelection({ keys: KEYS, ...options, ...props }));
}

describe('useSelection', () => {
  it('toggles keys and lists them in the order they were selected', () => {
    const { result } = setup();
    act(() => result.current.toggle('c'));
    act(() => result.current.toggle('a'));
    expect(result.current.value).toEqual(['c', 'a']);
    expect(result.current.isSelected('c')).toBe(true);
    expect(result.current.isSelected('b')).toBe(false);
    act(() => result.current.toggle('c'));
    expect(result.current.value).toEqual(['a']);
  });

  it('reports none, some and all over the enabled keys', () => {
    const { result } = setup({ disabledKeys: ['e'], defaultValue: [] });
    expect(result.current.state).toBe('none');
    act(() => result.current.toggle('a'));
    expect(result.current.state).toBe('some');
    act(() => result.current.toggleAll());
    expect(result.current.state).toBe('all');
    expect(result.current.value).not.toContain('e');
  });

  it('reports none when there are no enabled keys', () => {
    const { result } = setup({ keys: [] });
    expect(result.current.state).toBe('none');
    expect(result.current.getSelectAllProps().disabled).toBe(true);
  });

  it('toggles a range from the last toggled key to the clicked key, in either direction', () => {
    const { result } = setup();
    act(() => result.current.toggle('b'));
    act(() => result.current.toggle('d', { range: true }));
    expect(result.current.value).toEqual(['b', 'c', 'd']);
    act(() => result.current.toggle('a', { range: true }));
    expect(result.current.value).toEqual(['b', 'c', 'd', 'a']);
  });

  it('sets a range to the new state of the clicked key', () => {
    const { result } = setup({ defaultValue: ['a', 'b', 'c', 'd'] });
    act(() => result.current.toggle('a'));
    expect(result.current.value).toEqual(['b', 'c', 'd']);
    act(() => result.current.toggle('c', { range: true }));
    expect(result.current.value).toEqual(['d']);
  });

  it('uses the last toggled key as the anchor, so ranges chain', () => {
    const { result } = setup();
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b', { range: true }));
    act(() => result.current.toggle('e', { range: true }));
    expect(result.current.value).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('toggles one key when there is no anchor, or the anchor left keys', () => {
    const { result, rerender } = setup();
    act(() => result.current.toggle('d', { range: true }));
    expect(result.current.value).toEqual(['d']);
    act(() => result.current.toggle('b'));
    rerender({ keys: ['d', 'e', 'f'] });
    act(() => result.current.toggle('f', { range: true }));
    expect(result.current.value).toEqual(['d', 'b', 'f']);
  });

  it('forgets the anchor after toggleAll and clear', () => {
    const { result } = setup();
    act(() => result.current.toggle('b'));
    act(() => result.current.clear());
    act(() => result.current.toggle('d', { range: true }));
    expect(result.current.value).toEqual(['d']);
  });

  it('skips disabled keys in a range and ignores a toggle of one', () => {
    const { result } = setup({ disabledKeys: ['c'] });
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('e', { range: true }));
    expect(result.current.value).toEqual(['a', 'b', 'd', 'e']);
    act(() => result.current.toggle('c'));
    expect(result.current.value).toEqual(['a', 'b', 'd', 'e']);
  });

  it('selects all enabled keys from none or some, and clears them from all', () => {
    const { result } = setup({ disabledKeys: ['b'], defaultValue: ['d'] });
    act(() => result.current.toggleAll());
    expect(result.current.value).toEqual(['d', 'a', 'c', 'e']);
    expect(result.current.state).toBe('all');
    act(() => result.current.toggleAll());
    expect(result.current.value).toEqual([]);
    act(() => result.current.toggleAll());
    expect(result.current.state).toBe('all');
  });

  it('leaves selected keys outside keys alone, except in clear', () => {
    const { result } = setup({ defaultValue: ['x', 'y'] });
    expect(result.current.state).toBe('none');
    act(() => result.current.toggleAll());
    expect(result.current.value).toEqual(['x', 'y', 'a', 'b', 'c', 'd', 'e']);
    act(() => result.current.toggleAll());
    expect(result.current.value).toEqual(['x', 'y']);
    act(() => result.current.clear());
    expect(result.current.value).toEqual([]);
  });

  it('keeps its own value when uncontrolled and reports changes', () => {
    const onValueChange = vi.fn();
    const { result } = setup({ defaultValue: ['a'], onValueChange });
    act(() => result.current.toggle('b'));
    expect(result.current.value).toEqual(['a', 'b']);
    expect(onValueChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('follows value when controlled, and only reports', () => {
    const onValueChange = vi.fn();
    const { result } = setup({ value: ['a'], onValueChange });
    act(() => result.current.toggle('b'));
    expect(result.current.value).toEqual(['a']);
    expect(onValueChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('does not report a change that changes nothing', () => {
    const onValueChange = vi.fn();
    const { result } = setup({ disabledKeys: KEYS, onValueChange });
    act(() => result.current.toggleAll());
    act(() => result.current.clear());
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('counts every call in one event', () => {
    const onValueChange = vi.fn();
    const { result } = setup({ onValueChange });
    act(() => {
      result.current.toggle('a');
      result.current.toggle('b');
    });
    expect(result.current.value).toEqual(['a', 'b']);
    expect(onValueChange).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('drops a change a controlled parent turned down', async () => {
    const onValueChange = vi.fn();
    const { result } = setup({ value: ['a'], onValueChange });
    act(() => result.current.toggle('b'));
    await act(() => Promise.resolve());
    act(() => result.current.toggle('c'));
    expect(onValueChange).toHaveBeenLastCalledWith(['a', 'c']);
  });

  it('adds a key listed twice in keys once', () => {
    const { result } = setup({ keys: ['a', 'a', 'b'] });
    act(() => result.current.toggleAll());
    expect(result.current.value).toEqual(['a', 'b']);
    expect(result.current.state).toBe('all');
  });

  it('works with numeric keys', () => {
    const { result } = renderHook(() => useSelection({ keys: [1, 2, 3] }));
    act(() => result.current.toggle(2));
    expect(result.current.isSelected(2)).toBe(true);
    expect(result.current.isSelected(1)).toBe(false);
  });
});

function List({ onRowChange, disabledKeys }: { onRowChange?: () => void; disabledKeys?: string[] }) {
  const selection = useSelection({ keys: KEYS, disabledKeys });
  return (
    <div>
      <Checkbox.Root {...selection.getSelectAllProps()}>Select all</Checkbox.Root>
      {KEYS.map((key) => (
        <Checkbox.Root key={key} {...selection.getCheckboxProps(key, { onChange: onRowChange })}>
          {`Select ${key}`}
        </Checkbox.Root>
      ))}
    </div>
  );
}

const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;

describe('useSelection prop getters', () => {
  it('wire the row boxes and the select-all box to the selection', () => {
    render(<List />);
    fireEvent.click(box('Select b'));
    expect(box('Select b').checked).toBe(true);
    expect(box('Select all').indeterminate).toBe(true);
    expect(box('Select all').checked).toBe(false);
    fireEvent.click(box('Select all'));
    expect(KEYS.every((key) => box(`Select ${key}`).checked)).toBe(true);
    expect(box('Select all').indeterminate).toBe(false);
    expect(box('Select all').checked).toBe(true);
    fireEvent.click(box('Select all'));
    expect(KEYS.some((key) => box(`Select ${key}`).checked)).toBe(false);
  });

  it('turn a click with Shift into a range', () => {
    render(<List />);
    fireEvent.click(box('Select a'));
    fireEvent.click(box('Select c'), { shiftKey: true });
    expect(['a', 'b', 'c', 'd'].map((key) => box(`Select ${key}`).checked)).toEqual([true, true, true, false]);
  });

  it('disable the box of a disabled key', () => {
    render(<List disabledKeys={['b']} />);
    expect(box('Select b').disabled).toBe(true);
    expect(box('Select a').disabled).toBe(false);
  });

  it('run the caller\'s onChange first, and skip the selection when it calls preventDefault', () => {
    const calls: string[] = [];
    const onValueChange = vi.fn();
    function Probe() {
      const selection = useSelection({ keys: KEYS, onValueChange });
      return (
        <Checkbox.Root
          {...selection.getCheckboxProps('a', {
            onChange: (event) => {
              calls.push('theirs');
              event.preventDefault();
            },
          })}
        >
          Select a
        </Checkbox.Root>
      );
    }
    render(<Probe />);
    fireEvent.click(box('Select a'));
    expect(calls).toEqual(['theirs']);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keep the caller\'s other props and merge disabled', () => {
    const { result } = setup({ disabledKeys: ['b'] });
    const props = result.current.getCheckboxProps('a', { name: 'rows', disabled: true });
    expect(props.name).toBe('rows');
    expect(props.disabled).toBe(true);
    expect(result.current.getCheckboxProps('b').disabled).toBe(true);
    expect(result.current.getSelectAllProps({ name: 'all' }).name).toBe('all');
  });
});
