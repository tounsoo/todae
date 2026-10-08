import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../index';
import { useAnnouncer, type AnnounceOptions } from './useAnnouncer';

const regions = () => document.querySelectorAll('[data-todae-announcer]');
const live = (politeness: 'polite' | 'assertive') =>
  document.querySelector<HTMLElement>(`[data-todae-announcer] [aria-live="${politeness}"]`)!;

function Speaker({ message, options }: { message?: string; options?: AnnounceOptions }) {
  const announce = useAnnouncer();
  useEffect(() => {
    if (message !== undefined) announce(message, options);
  }, [announce, message, options]);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  for (const node of regions()) node.remove();
});

describe('useAnnouncer', () => {
  it('is exported from the package', () => {
    expect(api.useAnnouncer).toBe(useAnnouncer);
  });

  it('adds one visually hidden region on mount, shared by every caller', () => {
    expect(regions()).toHaveLength(0);
    render(
      <>
        <Speaker />
        <Speaker />
      </>,
    );
    render(<Speaker />);
    expect(regions()).toHaveLength(1);
    const root = regions()[0] as HTMLElement;
    expect(root.className).toBe('todae-visually-hidden');
    expect(root.parentElement).toBe(document.body);
    expect(live('polite').getAttribute('aria-atomic')).toBe('true');
    expect(live('assertive').getAttribute('aria-atomic')).toBe('true');
  });

  it('returns the same function on every render', () => {
    const seen: unknown[] = [];
    function Probe({ n }: { n: number }) {
      seen.push(useAnnouncer());
      return <span>{n}</span>;
    }
    const { rerender } = render(<Probe n={1} />);
    rerender(<Probe n={2} />);
    expect(seen[0]).toBe(seen[1]);
  });

  it('empties the region, then writes the message', () => {
    render(<Speaker message="3 results" />);
    expect(live('polite').textContent).toBe('');
    act(() => vi.runAllTimers());
    expect(live('polite').textContent).toBe('3 results');
    expect(live('assertive').textContent).toBe('');
  });

  it('reads the same message again by emptying the region first', () => {
    let announce!: ReturnType<typeof useAnnouncer>;
    function Grab() {
      announce = useAnnouncer();
      return null;
    }
    render(<Grab />);
    announce('Saved');
    vi.runAllTimers();
    expect(live('polite').textContent).toBe('Saved');
    announce('Saved');
    expect(live('polite').textContent).toBe('');
    vi.runAllTimers();
    expect(live('polite').textContent).toBe('Saved');
  });

  it('lets a newer message replace one not written yet', () => {
    let announce!: ReturnType<typeof useAnnouncer>;
    function Grab() {
      announce = useAnnouncer();
      return null;
    }
    render(<Grab />);
    announce('Loading');
    announce('Loaded');
    vi.runAllTimers();
    expect(live('polite').textContent).toBe('Loaded');
    announce('');
    vi.runAllTimers();
    expect(live('polite').textContent).toBe('');
  });

  it('writes assertive messages to the assertive region', () => {
    render(<Speaker message="Connection lost" options={{ politeness: 'assertive' }} />);
    act(() => vi.runAllTimers());
    expect(live('assertive').textContent).toBe('Connection lost');
    expect(live('polite').textContent).toBe('');
  });

  it('still writes a message sent just before the caller unmounts', () => {
    const { unmount } = render(<Speaker message="Deleted" />);
    unmount();
    vi.runAllTimers();
    expect(live('polite').textContent).toBe('Deleted');
  });

  it('recreates the region when the page removed it', () => {
    let announce!: ReturnType<typeof useAnnouncer>;
    function Grab() {
      announce = useAnnouncer();
      return null;
    }
    render(<Grab />);
    regions()[0]!.remove();
    announce('Back');
    vi.runAllTimers();
    expect(regions()).toHaveLength(1);
    expect(live('polite').textContent).toBe('Back');
  });
});
