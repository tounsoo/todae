import { act, cleanup, render } from '@testing-library/react';
import { Activity } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StringsProvider } from '../providers/StringsProvider';
import { useClipboard, type UseClipboardOptions, type UseClipboardResult } from './useClipboard';

const live = (politeness: 'polite' | 'assertive') =>
  document.querySelector<HTMLElement>(`[data-todae-announcer] [aria-live="${politeness}"]`)?.textContent ?? '';

let result: UseClipboardResult;
function Probe(props: UseClipboardOptions) {
  result = useClipboard(props);
  return null;
}

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});

afterEach(async () => {
  cleanup();
  // Let pending announcer writes land before the regions go.
  await act(() => vi.runAllTimersAsync());
  vi.useRealTimers();
  for (const node of document.querySelectorAll('[data-todae-announcer]')) node.remove();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('useClipboard', () => {
  it('copies, reports copied, announces it, and returns to idle after resetAfter', async () => {
    render(<Probe />);
    expect(result.status).toBe('idle');
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.copy('hello');
    });
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(ok).toBe(true);
    expect(result.status).toBe('copied');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live('polite')).toBe('Copied');
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(result.status).toBe('copied');
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.status).toBe('idle');
  });

  it('reports failed and announces assertively when writeText rejects', async () => {
    writeText.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    render(<Probe />);
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.copy('hello');
    });
    expect(ok).toBe(false);
    expect(result.status).toBe('failed');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live('assertive')).toBe('Could not copy');
  });

  it('fails without throwing when the Clipboard API is missing', async () => {
    Reflect.deleteProperty(navigator, 'clipboard');
    render(<Probe />);
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.copy('hello');
    });
    expect(ok).toBe(false);
    expect(result.status).toBe('failed');
  });

  it('keeps status with resetAfter false until reset()', async () => {
    render(<Probe resetAfter={false} />);
    await act(async () => {
      await result.copy('hello');
    });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(result.status).toBe('copied');
    act(() => result.reset());
    expect(result.status).toBe('idle');
  });

  it('takes its messages from props, then StringsProvider, and reads nothing for an empty string', async () => {
    const { rerender } = render(
      <StringsProvider strings={{ copied: '복사했습니다' }}>
        <Probe />
      </StringsProvider>,
    );
    await act(async () => {
      await result.copy('a');
    });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live('polite')).toBe('복사했습니다');

    rerender(
      <StringsProvider strings={{ copied: '복사했습니다' }}>
        <Probe copiedMessage="Link copied" />
      </StringsProvider>,
    );
    await act(async () => {
      await result.copy('b');
    });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live('polite')).toBe('Link copied');

    rerender(<Probe copiedMessage="" />);
    await act(async () => {
      await result.copy('c');
    });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live('polite')).toBe('Link copied');
    expect(result.status).toBe('copied');
  });

  it('lets only the latest copy set status', async () => {
    let finishFirst: () => void = () => {};
    writeText.mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)));
    writeText.mockRejectedValueOnce(new Error('denied'));
    render(<Probe />);
    let first: Promise<boolean> | undefined;
    act(() => {
      first = result.copy('slow');
    });
    await act(async () => {
      await result.copy('fast');
    });
    expect(result.status).toBe('failed');
    await act(async () => {
      finishFirst();
      expect(await first).toBe(true);
    });
    expect(result.status).toBe('failed');
  });

  it('keeps the last outcome and its text while a new copy is pending', async () => {
    render(<Probe resetAfter={false} />);
    await act(async () => {
      await result.copy('first');
    });
    expect(result).toMatchObject({ status: 'copied', text: 'first' });
    writeText.mockImplementationOnce(() => new Promise<void>(() => {}));
    act(() => {
      void result.copy('second');
    });
    expect(result).toMatchObject({ status: 'copied', text: 'first' });
    act(() => result.reset());
    expect(result).toMatchObject({ status: 'idle', text: null });
  });

  it('still announces a copy that settles after unmount', async () => {
    let finish: () => void = () => {};
    writeText.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    const { unmount } = render(<Probe />);
    let pending: Promise<boolean> | undefined;
    act(() => {
      pending = result.copy('x');
    });
    unmount();
    finish();
    expect(await pending).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live('polite')).toBe('Copied');
  });

  it('restarts the reset timer when an Activity is shown again', async () => {
    const { rerender } = render(
      <Activity mode="visible">
        <Probe />
      </Activity>,
    );
    await act(async () => {
      await result.copy('a');
    });
    rerender(
      <Activity mode="hidden">
        <Probe />
      </Activity>,
    );
    await act(() => vi.advanceTimersByTimeAsync(5000));
    rerender(
      <Activity mode="visible">
        <Probe />
      </Activity>,
    );
    expect(result.status).toBe('copied');
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(result.status).toBe('idle');
  });

  it('restarts the timer for each copy, and never resets past the longest setTimeout delay', async () => {
    const { rerender } = render(<Probe />);
    await act(async () => {
      await result.copy('a');
    });
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await act(async () => {
      await result.copy('b');
    });
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(result).toMatchObject({ status: 'copied', text: 'b' });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(result.status).toBe('idle');

    rerender(<Probe resetAfter={2 ** 31} />);
    await act(async () => {
      await result.copy('c');
    });
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(result.status).toBe('copied');
  });
});
