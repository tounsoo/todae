import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../index.js';
import { useControlledState, useControlledValue } from './useControlledState.js';

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
