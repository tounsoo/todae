import { act, cleanup, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { resetMatchMedia, setMatchMedia } from '../test/setup.js';
import {
  resolveSheetPresentation,
  SHEET_NARROW_WIDTH,
  useSheetPresentation,
} from './useSheetPresentation.js';

afterEach(() => {
  cleanup();
  resetMatchMedia();
});

function Probe() {
  const sheet = useSheetPresentation();
  return `${sheet.presentation}:${sheet.isSheet}:${sheet.measured}`;
}

describe('resolveSheetPresentation', () => {
  it.each([
    [{ coarse: false, narrow: false }, 'popover'],
    [{ coarse: true, narrow: false }, 'sheet'],
    [{ coarse: false, narrow: true }, 'sheet'],
    [{ coarse: true, narrow: true }, 'sheet'],
  ] as const)('%o → %s', (input, expected) => {
    expect(resolveSheetPresentation(input)).toBe(expected);
  });
});

describe('useSheetPresentation', () => {
  it('uses a popover server snapshot', () => {
    expect(renderToString(<Probe />)).toBe('popover:false:false');
  });

  it('stays popover until measured when media is idle', () => {
    const { result } = renderHook(() => useSheetPresentation());
    expect(result.current.presentation).toBe('popover');
    expect(result.current.isSheet).toBe(false);
    expect(result.current.measured).toBe(true);
    expect(SHEET_NARROW_WIDTH).toBe(640);
  });

  it('lets forced override media', () => {
    setMatchMedia('(pointer: coarse)', true);
    const { result, rerender } = renderHook(
      (forced: 'popover' | 'sheet') => useSheetPresentation({ forced }),
      { initialProps: 'popover' as 'popover' | 'sheet' },
    );
    expect(result.current.presentation).toBe('popover');
    rerender('sheet');
    expect(result.current.presentation).toBe('sheet');
  });

  it('re-renders when either query changes and unsubscribes on unmount', () => {
    const { result, unmount } = renderHook(() => useSheetPresentation());
    expect(result.current.presentation).toBe('popover');
    act(() => setMatchMedia('(pointer: coarse)', true));
    expect(result.current.presentation).toBe('sheet');
    act(() => {
      setMatchMedia('(pointer: coarse)', false);
      setMatchMedia('(max-width: 639px)', true);
    });
    expect(result.current.presentation).toBe('sheet');
    unmount();
    act(() => setMatchMedia('(pointer: coarse)', true));
  });
});
