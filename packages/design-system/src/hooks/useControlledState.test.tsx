import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../index.js';
import { useControllableState, useControlledState, useControlledValue } from './useControlledState.js';

afterEach(cleanup);

describe('useControlledState', () => {
  it('is exported from the package', () => {
    expect(api.useControlledState).toBe(useControlledState);
  });

  it('keeps its own state when uncontrolled', () => {
    const { result } = renderHook(() => useControlledState<string | undefined>(undefined, 'a'));
    expect(result.current[0]).toBe('a');
    act(() => result.current[1]('b'));
    expect(result.current[0]).toBe('b');
  });

  it('follows the prop and ignores the setter when controlled', () => {
    const { result, rerender } = renderHook(({ value }) => useControlledState(value, 'a'), {
      initialProps: { value: 'x' },
    });
    act(() => result.current[1]('b'));
    expect(result.current[0]).toBe('x');
    rerender({ value: 'y' });
    expect(result.current[0]).toBe('y');
  });

  it('treats null as a controlled value', () => {
    const { result } = renderHook(() => useControlledState<string | null>(null, 'a'));
    act(() => result.current[1]('b'));
    expect(result.current[0]).toBeNull();
  });

  it('reads defaultValue on the first render only', () => {
    const { result, rerender } = renderHook(({ initial }) => useControlledState<string | undefined>(undefined, initial), {
      initialProps: { initial: 'a' },
    });
    rerender({ initial: 'b' });
    expect(result.current[0]).toBe('a');
  });
});

describe('useControlledValue', () => {
  it('is exported from the package', () => {
    expect(api.useControlledValue).toBe(useControlledValue);
  });

  it('stores the value and calls onChange with extra arguments when uncontrolled', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControlledValue<string | undefined, [reason: string]>(undefined, 'a', onChange),
    );
    act(() => result.current[1]('b', 'click'));
    expect(result.current[0]).toBe('b');
    expect(onChange).toHaveBeenCalledWith('b', 'click');
  });

  it('calls onChange but keeps the prop when controlled', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControlledValue<string>('x', 'a', onChange));
    act(() => result.current[1]('b'));
    expect(result.current[0]).toBe('x');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('skips a value equal to the current one', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControlledValue<number | undefined>(undefined, Number.NaN, onChange));
    act(() => result.current[1](Number.NaN));
    expect(onChange).not.toHaveBeenCalled();
    act(() => result.current[1](1));
    act(() => result.current[1](1));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('compares with the value from the last render, so two calls in one event both go through', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControlledValue<string>(undefined, 'all', onChange));
    act(() => {
      result.current[1]('open');
      result.current[1]('open');
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('works without onChange', () => {
    const { result } = renderHook(() => useControlledValue<boolean | undefined>(undefined, false));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});

describe('useControllableState', () => {
  it('is internal, not exported from the package', () => {
    expect('useControllableState' in api).toBe(false);
  });

  it('builds each write on the latest one, so two writes before a render both count', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState<number>(undefined, 0, onChange));
    act(() => {
      const [, set, latest] = result.current;
      set(latest() + 1);
      set(latest() + 1);
      set(2);
    });
    expect(onChange.mock.calls).toEqual([[1], [2]]);
    expect(result.current[0]).toBe(2);
  });

  it('passes extra arguments, such as a reason, to onChange', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState<boolean, [reason: string]>(undefined, false, onChange));
    act(() => result.current[1](true, 'click'));
    expect(onChange).toHaveBeenCalledWith(true, 'click');
  });

  it('drops a controlled change the owner turned down by the next render, and builds on the value it passed', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState<string>('a', 'z', onChange));
    act(() => {
      result.current[1]('b');
      result.current[1]('b');
    });
    expect(onChange.mock.calls).toEqual([['b']]);
    expect(result.current[0]).toBe('a');
    expect(result.current[2]()).toBe('a');
    act(() => result.current[1]('b'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('builds on a value the owner passed back', () => {
    const { result, rerender } = renderHook(({ value }) => useControllableState<string>(value, 'z', vi.fn()), {
      initialProps: { value: 'a' },
    });
    act(() => result.current[1]('b'));
    rerender({ value: 'b' });
    expect(result.current[2]()).toBe('b');
  });

  it('does nothing for a controlled value with no onChange, and does not render again', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useControllableState<string>('a', 'z');
    });
    const before = renders;
    act(() => result.current[1]('b'));
    expect(renders).toBe(before);
    expect(result.current[2]()).toBe('a');
  });

  it('calls the onChange of the latest render, through a setter that keeps its identity', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ onChange }) => useControllableState<number>(undefined, 0, onChange), {
      initialProps: { onChange: first },
    });
    const set = result.current[1];
    rerender({ onChange: second });
    expect(result.current[1]).toBe(set);
    act(() => set(1));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(1);
  });

  it('stores a function value as the value, not as an updater', () => {
    const fn = () => 'x';
    const { result } = renderHook(() => useControllableState<(() => string) | null>(undefined, null));
    act(() => result.current[1](fn));
    expect(result.current[0]).toBe(fn);
  });
});
