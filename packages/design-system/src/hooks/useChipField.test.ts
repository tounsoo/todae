import { act, renderHook } from '@testing-library/react';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { FieldChipInputProps } from '../components/Field';
import { useChipField } from './useChipField';

describe('useChipField', () => {
  it('keeps reset stable and restores the latest initial values', () => {
    const { result, rerender } = renderHook(({ chips }) => useChipField({ initialChips: chips }), {
      initialProps: { chips: ['a'] },
    });
    const reset = result.current.reset;
    rerender({ chips: ['b'] });
    expect(result.current.reset).toBe(reset);
    act(() => result.current.getChipInputProps().onCommit('x'));
    act(() => result.current.reset());
    expect(result.current.chips).toEqual(['b']);
  });

  it('appends trimmed unique commits and clears the input', () => {
    const { result } = renderHook(() => useChipField());
    act(() => result.current.getChipInputProps().onInputValueChange('  Alpha  '));
    act(() => result.current.getChipInputProps().onCommit('  Alpha  '));
    expect(result.current.chips).toEqual(['Alpha']);
    expect(result.current.inputValue).toBe('');
    act(() => result.current.getChipInputProps().onCommit('   '));
    expect(result.current.chips).toEqual(['Alpha']);
    act(() => result.current.getChipInputProps().onCommit('Alpha'));
    expect(result.current.chips).toEqual(['Alpha']);
  });

  it('rejects transform null and removes by index', () => {
    const { result } = renderHook(() =>
      useChipField({
        initialChips: ['Alpha', 'Beta'],
        transform: (raw) => (raw.includes('x') ? null : raw.trim()),
      }),
    );
    act(() => result.current.getChipInputProps().onCommit('xray'));
    expect(result.current.chips).toEqual(['Alpha', 'Beta']);
    act(() => result.current.getChipInputProps().onChipRemove(0, 'Alpha'));
    expect(result.current.chips).toEqual(['Beta']);
  });

  it('resets to initials', () => {
    const { result } = renderHook(() =>
      useChipField({ initialChips: ['A'], initialInputValue: 'q' }),
    );
    act(() => result.current.getChipInputProps().onCommit('B'));
    act(() => result.current.getChipInputProps().onInputValueChange('z'));
    act(() => result.current.reset());
    expect(result.current.chips).toEqual(['A']);
    expect(result.current.inputValue).toBe('q');
  });

  it('returns spread-compatible Field.ChipInput props, and nothing else to spread', () => {
    function accept(_props: FieldChipInputProps) {}
    const { result } = renderHook(() => useChipField({ initialChips: ['A'], initialInputValue: 'q' }));
    const props = result.current.getChipInputProps();
    accept(props);
    expectTypeOf(props.chips).toEqualTypeOf<FieldChipInputProps['chips']>();
    expectTypeOf(props.onCommit).toEqualTypeOf<FieldChipInputProps['onCommit']>();
    expect(Object.keys(props).sort()).toEqual(['chips', 'inputValue', 'onChipRemove', 'onCommit', 'onInputValueChange']);
    expect(props.chips).toEqual(['A']);
    expect(props.inputValue).toBe('q');
  });

  it('sets chips and input text directly', () => {
    const { result } = renderHook(() => useChipField({ initialChips: ['A'] }));
    act(() => result.current.setChips(['B', 'C']));
    act(() => result.current.setInputValue('d'));
    expect(result.current.getChipInputProps().chips).toEqual(['B', 'C']);
    expect(result.current.getChipInputProps().inputValue).toBe('d');
  });
});
