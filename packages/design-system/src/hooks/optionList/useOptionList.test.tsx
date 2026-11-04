import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resetWarnOnce } from '../../internal/warnOnce.js';
import type { ComboboxOption } from './types.js';
import { useOptionList, type OptionListConfig } from './useOptionList.js';

const ROWS: ComboboxOption[] = [
  { value: 'ada', label: 'Ada' },
  { value: 'alan', label: 'Alan' },
  { value: 'barbara', label: 'Barbara', disabled: true },
  { value: 'grace', label: 'Grace' },
];

type Props = Omit<OptionListConfig, 'listboxId'>;

function setup(initial: Props) {
  return renderHook((props: Props) => useOptionList({ listboxId: 'list', ...props }), { initialProps: initial });
}

/** A loader whose calls settle when the test says. */
function manualLoader() {
  const calls: { query: string; signal: AbortSignal; resolve: (rows: readonly ComboboxOption[]) => void; reject: (reason?: unknown) => void }[] = [];
  const loadOptions = vi.fn(
    (query: string, signal: AbortSignal) =>
      new Promise<readonly ComboboxOption[]>((resolve, reject) => calls.push({ query, signal, resolve, reject })),
  );
  const settle = (index: number, run: (call: (typeof calls)[number]) => void) =>
    act(async () => {
      run(calls[index]!);
      await Promise.resolve();
      await Promise.resolve();
    });
  return { calls, loadOptions, settle };
}

describe('useOptionList sync options', () => {
  it('filters by label, ignoring case, and makes the first enabled row active', () => {
    const { result } = setup({ options: ROWS, query: 'a' });
    expect(result.current.options.map((row) => row.value)).toEqual(['ada', 'alan', 'barbara', 'grace']);
    expect(result.current.enabledValues).toEqual(['ada', 'alan', 'grace']);
    expect(result.current.activeValue).toBe('ada');
    expect(result.current.activeId).toBe('list-opt-ada');
    expect(result.current.listIsCurrent).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('shows nothing and loads nothing while no list is asked for', () => {
    const loadOptions = vi.fn(async () => ROWS);
    const { result } = setup({ loadOptions, query: null });
    expect(result.current.options).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.isEmpty).toBe(false);
    expect(loadOptions).not.toHaveBeenCalled();
  });

  it('is empty only when the current list has no rows and no trailing row', () => {
    const { result, rerender } = setup({ options: ROWS, query: 'zz' });
    expect(result.current.isEmpty).toBe(true);
    rerender({ options: ROWS, query: 'zz', trailing: () => '__create__' });
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.enabledValues).toEqual(['__create__']);
  });

  it('disables a row canPick refuses, and leaves it out of the keys', () => {
    const { result } = setup({ options: ROWS, query: '', canPick: (row) => row.value !== 'ada' });
    expect(result.current.enabledValues).toEqual(['alan', 'grace']);
    expect(result.current.getOptionProps(ROWS[0]!).disabled).toBe(true);
    expect(result.current.getOptionProps(ROWS[1]!).disabled).toBeUndefined();
    expect(result.current.getOptionProps(ROWS[2]!).disabled).toBe(true);
  });

  it('shows the rows filterOptions returns, in its order, and makes its first enabled row active', () => {
    const filterOptions = vi.fn((rows: readonly ComboboxOption[], query: string) =>
      [...rows.filter((row) => row.label.toLowerCase().includes(query))].reverse().slice(0, 2),
    );
    const { result } = setup({ options: ROWS, query: '  a ', filterOptions });
    expect(filterOptions).toHaveBeenLastCalledWith(ROWS, 'a');
    expect(result.current.options.map((row) => row.value)).toEqual(['grace', 'barbara']);
    expect(result.current.activeValue).toBe('grace');
  });

  it('asks filterOptions for the open list with an empty query', () => {
    const { result } = setup({ options: ROWS, query: ' ', filterOptions: (rows, query) => (query === '' ? rows.slice(0, 1) : rows) });
    expect(result.current.options.map((row) => row.value)).toEqual(['ada']);
  });

  it('makes the preferred row active while nothing is chosen, if it is enabled', () => {
    const { result, rerender } = setup({ options: ROWS, query: '', preferred: 'grace' });
    expect(result.current.activeValue).toBe('grace');
    rerender({ options: ROWS, query: '', preferred: 'barbara' });
    expect(result.current.activeValue).toBe('ada');
  });
});

describe('useOptionList keys', () => {
  it('moves down and up one row and stops at either end', () => {
    const { result } = setup({ options: ROWS, query: '' });
    act(() => result.current.move(-1));
    expect(result.current.activeValue).toBe('ada');
    act(() => result.current.move(1));
    act(() => result.current.move(1));
    expect(result.current.activeValue).toBe('grace');
    act(() => result.current.move(1));
    expect(result.current.activeValue).toBe('grace');
    act(() => result.current.move('first'));
    expect(result.current.activeValue).toBe('ada');
    act(() => result.current.move('last'));
    expect(result.current.activeValue).toBe('grace');
  });

  it('sends up to the last row and down to the first when no row is active', async () => {
    const { loadOptions, settle } = manualLoader();
    const { result, rerender } = setup({ loadOptions, query: 'a' });
    await settle(0, (call) => call.resolve(ROWS));
    // The next query's list is out: the last rows show, and none is active.
    rerender({ loadOptions, query: 'al' });
    expect(result.current.activeValue).toBeNull();
    act(() => result.current.move(-1));
    expect(result.current.activeValue).toBe('grace');
    act(() => result.current.highlight(null));
    act(() => result.current.move(1));
    expect(result.current.activeValue).toBe('ada');
  });

  it('does nothing with no row to move to', () => {
    const { result } = setup({ options: ROWS, query: 'zz' });
    act(() => result.current.move(1));
    expect(result.current.activeValue).toBeNull();
  });

  it('forgets a highlight once its row leaves the list, so it does not come back with it', () => {
    const { result, rerender } = setup({ options: ROWS, query: 'a' });
    act(() => result.current.highlight('grace'));
    expect(result.current.activeValue).toBe('grace');
    rerender({ options: ROWS, query: 'al' });
    expect(result.current.activeValue).toBe('alan');
    rerender({ options: ROWS, query: 'a' });
    expect(result.current.activeValue).toBe('ada');
  });

  it('starts new text at its own first row, even when the highlighted row is still listed', () => {
    const rank = (rows: readonly ComboboxOption[], query: string) =>
      [...rows.filter((row) => row.label.toLowerCase().includes(query))].sort(
        (a, b) => Number(!a.label.toLowerCase().startsWith(query)) - Number(!b.label.toLowerCase().startsWith(query)),
      );
    const { result, rerender } = setup({ options: ROWS, query: '', filterOptions: rank });
    act(() => result.current.highlight('grace'));
    rerender({ options: ROWS, query: 'g', filterOptions: rank });
    expect(result.current.activeValue).toBe('grace');
    act(() => result.current.move(1));
    rerender({ options: ROWS, query: 'a', filterOptions: rank });
    expect(result.current.options.map((row) => row.value)).toEqual(['ada', 'alan', 'barbara', 'grace']);
    expect(result.current.activeValue).toBe('ada');
    // Spaces around the text leave it the same text, so the highlight stays.
    act(() => result.current.highlight('grace'));
    rerender({ options: ROWS, query: 'a ', filterOptions: rank });
    expect(result.current.activeValue).toBe('grace');
  });

  it('keeps a highlight to its own scope', () => {
    const { result, rerender } = setup({ options: ROWS, query: '', scope: 'one' });
    act(() => result.current.highlight('grace'));
    rerender({ options: ROWS, query: '', scope: 'two' });
    expect(result.current.activeValue).toBe('ada');
  });

  it('wires the active row into the listbox props', () => {
    const { result } = setup({ options: ROWS, query: '' });
    act(() => result.current.listboxProps.onActiveValueChange('alan'));
    expect(result.current.listboxProps).toMatchObject({ id: 'list', activeValue: 'alan', tabIndex: -1 });
  });
});

describe('useOptionList async options', () => {
  it('discards a stale load and shows the newest query\'s rows', async () => {
    const { calls, loadOptions, settle } = manualLoader();
    const { result, rerender } = setup({ loadOptions, query: 'old' });
    expect(result.current.loading).toBe(true);
    rerender({ loadOptions, query: 'new' });
    expect(calls[0]!.signal.aborted).toBe(true);
    await settle(0, (call) => call.resolve([{ value: 'stale', label: 'Stale' }]));
    expect(result.current.options).toEqual([]);
    await settle(1, (call) => call.resolve([{ value: 'fresh', label: 'Fresh' }]));
    expect(result.current.options.map((row) => row.value)).toEqual(['fresh']);
    expect(result.current.loading).toBe(false);
  });

  it('loads for the trimmed query, so surrounding spaces load nothing new', async () => {
    const { calls, loadOptions } = manualLoader();
    const { rerender } = setup({ loadOptions, query: ' jo' });
    rerender({ loadOptions, query: 'jo ' });
    expect(calls.map((call) => call.query)).toEqual(['jo']);
  });

  it('warns in development that sync options are ignored next to a loader', () => {
    resetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { loadOptions } = manualLoader();
    setup({ loadOptions, options: ROWS, query: 'a' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ignored while loadOptions is set'));
    warn.mockRestore();
  });

  it('shows loaded rows as the loader returns them, without the sync filter', async () => {
    const { loadOptions, settle } = manualLoader();
    const filterOptions = vi.fn(() => []);
    const { result } = setup({ loadOptions, query: 'jdoe', filterOptions });
    await settle(0, (call) => call.resolve([{ value: 'john', label: 'John Doe' }]));
    expect(result.current.options.map((row) => row.value)).toEqual(['john']);
    expect(filterOptions).not.toHaveBeenCalled();
  });

  it('keeps the last rows of its scope on show while the next query loads, with no row active', async () => {
    const { loadOptions, settle } = manualLoader();
    const { result, rerender } = setup({ loadOptions, query: 'a', scope: 'one' });
    await settle(0, (call) => call.resolve(ROWS));
    rerender({ loadOptions, query: 'al', scope: 'one' });
    expect(result.current.options).toHaveLength(4);
    expect(result.current.listIsCurrent).toBe(false);
    expect(result.current.loading).toBe(true);
    expect(result.current.activeValue).toBeNull();
    expect(result.current.isEmpty).toBe(false);
    // Another scope never shows them.
    rerender({ loadOptions, query: 'al', scope: 'two' });
    expect(result.current.options).toEqual([]);
  });

  it('keeps a row chosen while the list loads, once the new list holds it', async () => {
    const { loadOptions, settle } = manualLoader();
    const { result, rerender } = setup({ loadOptions, query: 'a' });
    await settle(0, (call) => call.resolve(ROWS));
    rerender({ loadOptions, query: '' });
    act(() => result.current.highlight('grace'));
    await settle(1, (call) => call.resolve(ROWS));
    expect(result.current.activeValue).toBe('grace');
  });

  it('asks for the trailing row only once the list is current', async () => {
    const { loadOptions, settle } = manualLoader();
    const trailing = vi.fn(() => '__create__');
    const { result } = setup({ loadOptions, query: 'x', trailing });
    expect(result.current.trailing).toBeNull();
    expect(trailing).not.toHaveBeenCalled();
    await settle(0, (call) => call.resolve([]));
    expect(result.current.trailing).toBe('__create__');
    expect(trailing).toHaveBeenLastCalledWith([]);
  });

  it('reads a load that throws, or rejects with no reason, as a failure that settles the query', async () => {
    for (const loadOptions of [
      () => {
        throw null;
      },
      () => Promise.reject(undefined),
    ]) {
      const { result, unmount } = setup({ loadOptions, query: 'a' });
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.loading).toBe(false);
      expect(result.current.isEmpty).toBe(false);
      expect(result.current.listIsCurrent).toBe(true);
      unmount();
    }
  });

  it('retries the same query, and is not current until the retry settles', async () => {
    const { calls, loadOptions, settle } = manualLoader();
    const { result } = setup({ loadOptions, query: 'a' });
    await settle(0, (call) => call.reject(new Error('down')));
    expect(result.current.error).toBeInstanceOf(Error);
    act(() => result.current.retry());
    expect(calls).toHaveLength(2);
    expect(calls[1]!.query).toBe('a');
    expect(result.current.error).toBeNull();
    expect(result.current.listIsCurrent).toBe(false);
    await settle(1, (call) => call.resolve(ROWS));
    expect(result.current.listIsCurrent).toBe(true);
  });

  it('waits for a newer load of the same query', async () => {
    const { loadOptions, settle } = manualLoader();
    const { result, rerender } = setup({ loadOptions, query: 'ab' });
    await settle(0, (call) => call.resolve([]));
    rerender({ loadOptions, query: 'abc' });
    rerender({ loadOptions, query: 'ab' });
    expect(result.current.listIsCurrent).toBe(false);
    await settle(2, (call) => call.resolve([]));
    expect(result.current.listIsCurrent).toBe(true);
  });

  it('loads once per query with an inline loader, and again when loadKey changes', async () => {
    const calls: string[] = [];
    const { rerender } = renderHook(
      ({ key }: { key: string }) =>
        useOptionList({
          listboxId: 'list',
          query: '',
          loadKey: key,
          loadOptions: async (query) => {
            calls.push(`${key}:${query}`);
            return [];
          },
        }),
      { initialProps: { key: 'a' } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ key: 'a' });
    rerender({ key: 'b' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(calls).toEqual(['a:', 'b:']);
  });

  it('forgets its rows and highlight on reset, and loads again', async () => {
    const { calls, loadOptions, settle } = manualLoader();
    const { result } = setup({ loadOptions, query: '' });
    await settle(0, (call) => call.resolve(ROWS));
    act(() => result.current.highlight('grace'));
    act(() => result.current.reset());
    expect(calls).toHaveLength(2);
    expect(result.current.options).toEqual([]);
    await settle(1, (call) => call.resolve(ROWS));
    expect(result.current.activeValue).toBe('ada');
  });

  it('aborts the load in flight on unmount', () => {
    const { calls, loadOptions } = manualLoader();
    const { unmount } = setup({ loadOptions, query: 'a' });
    unmount();
    expect(calls[0]!.signal.aborted).toBe(true);
  });
});
