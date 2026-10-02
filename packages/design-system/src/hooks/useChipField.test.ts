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
    act(() => result.current.onCommit('x'));
    act(() => result.current.reset());
    expect(result.current.chips).toEqual(['b']);
  });

  it('appends trimmed unique commits and clears the input', () => {
    const { result } = renderHook(() => useChipField());
    act(() => result.current.onInputValueChange('  Alpha  '));
    act(() => result.current.onCommit('  Alpha  '));
    expect(result.current.chips).toEqual(['Alpha']);
    expect(result.current.inputValue).toBe('');
    act(() => result.current.onCommit('   '));
    expect(result.current.chips).toEqual(['Alpha']);
    act(() => result.current.onCommit('Alpha'));
    expect(result.current.chips).toEqual(['Alpha']);
  });

  it('rejects transform null and removes by index', () => {
    const { result } = renderHook(() =>
      useChipField({
        initialChips: ['Alpha', 'Beta'],
        transform: (raw) => (raw.includes('x') ? null : raw.trim()),
      }),
    );
    act(() => result.current.onCommit('xray'));
    expect(result.current.chips).toEqual(['Alpha', 'Beta']);
    act(() => result.current.onChipRemove(0));
    expect(result.current.chips).toEqual(['Beta']);
  });

  it('resets to initials', () => {
    const { result } = renderHook(() =>
      useChipField({ initialChips: ['A'], initialInputValue: 'q' }),
    );
    act(() => result.current.onCommit('B'));
    act(() => result.current.onInputValueChange('z'));
    act(() => result.current.reset());
    expect(result.current.chips).toEqual(['A']);
    expect(result.current.inputValue).toBe('q');
  });

  it('returns spread-compatible Field.ChipInput props', () => {
    function accept(_props: FieldChipInputProps) {}
    const { result } = renderHook(() => useChipField());
    accept(result.current);
    expectTypeOf(result.current.chips).toEqualTypeOf<FieldChipInputProps['chips']>();
    expectTypeOf(result.current.onCommit).toEqualTypeOf<FieldChipInputProps['onCommit']>();
  });
});
