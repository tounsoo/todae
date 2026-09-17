import { act, renderHook } from '@testing-library/react';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ChipFieldProps } from '../components/ChipField';
import { useChipField } from './useChipField';

describe('useChipField', () => {
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

  it('returns spread-compatible ChipField props', () => {
    type Hook = ReturnType<typeof useChipField>;
    expectTypeOf<Hook['chips']>().toEqualTypeOf<ChipFieldProps['chips']>();
    expectTypeOf<Hook['inputValue']>().toEqualTypeOf<ChipFieldProps['inputValue']>();
    expectTypeOf<Hook['onInputValueChange']>().toEqualTypeOf<ChipFieldProps['onInputValueChange']>();
    expectTypeOf<Hook['onCommit']>().toEqualTypeOf<ChipFieldProps['onCommit']>();
    expectTypeOf<Hook['onChipRemove']>().toMatchTypeOf<ChipFieldProps['onChipRemove']>();
  });
});
