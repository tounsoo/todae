import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dropModal, heldModals, pushModal } from '../overlay/modalStack';
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
const pending = () =>
  (globalThis as unknown as Record<symbol, Record<string, ReturnType<typeof setTimeout>> | undefined>)[
    Symbol.for('todae.announcer.pending')
  ];

afterEach(() => {
  cleanup();
  // Drop writes still pending, so none lands in a later test.
  for (const [key, id] of Object.entries(pending() ?? {})) {
    clearTimeout(id);
    delete pending()![key];
  }
  vi.useRealTimers();
  for (const node of regions()) node.remove();
});

describe('useAnnouncer', () => {
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
    expect(root.style.position).toBe('absolute');
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

  it('starts over in a new, empty region when the region is removed before the write', () => {
    render(<Speaker message="Saved" />);
    for (const node of regions()) node.remove();
    act(() => vi.advanceTimersByTime(100));
    expect(regions()).toHaveLength(1);
    expect(live('polite').textContent).toBe('');
    act(() => vi.advanceTimersByTime(100));
    expect(live('polite').textContent).toBe('Saved');
  });

  it('keeps the pending write on globalThis, where every copy of the package sees it', () => {
    render(<Speaker message="Saved" />);
    expect(pending()?.polite).toBeDefined();
    act(() => vi.advanceTimersByTime(100));
    expect(pending()?.polite).toBeUndefined();
    expect(document.documentElement.attributes).toHaveLength(0);
  });

  // An open modal in Todae's modal stack, shown after the ones before it.
  function modal(attrs: Record<string, string> = {}) {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    dialog.setAttribute('aria-modal', 'true');
    for (const [name, value] of Object.entries(attrs)) dialog.setAttribute(name, value);
    document.body.append(dialog);
    pushModal(dialog);
    return dialog;
  }
  const bodyLive = () => document.body.querySelector<HTMLElement>(':scope > [data-todae-announcer] [aria-live="polite"]')!;
  const liveIn = (host: Element) => host.querySelector<HTMLElement>(':scope > [data-todae-announcer] [aria-live="polite"]');
  afterEach(() => {
    for (const dialog of [...heldModals()]) dropModal(dialog);
    for (const dialog of document.querySelectorAll('dialog')) dialog.remove();
  });

  it('writes inside a modal that opened after the message was sent', () => {
    render(<Speaker message="Opening editor" />);
    const dialog = modal();
    act(() => vi.advanceTimersByTime(100));
    // A new region in the dialog sits empty for a moment first.
    expect(liveIn(dialog)?.textContent).toBe('');
    act(() => vi.advanceTimersByTime(100));
    expect(liveIn(dialog)?.textContent).toBe('Opening editor');
    expect(bodyLive().textContent).toBe('');
  });

  it('waits for a modal in its exit motion to close, then writes in body', () => {
    const dialog = modal({ 'data-exiting': '' });
    render(<Speaker message="Deleted" />);
    // Longer than a region gets to settle: the exit is waited out.
    act(() => vi.advanceTimersByTime(3000));
    expect(bodyLive().textContent).toBe('');
    expect(liveIn(dialog)).toBeNull();
    dialog.remove();
    // Body was inert a moment ago: it sits reachable and empty first.
    act(() => vi.advanceTimersByTime(100));
    expect(bodyLive().textContent).toBe('');
    act(() => vi.advanceTimersByTime(100));
    expect(bodyLive().textContent).toBe('Deleted');
  });

  it('writes in a modal that has looked like it was closing for too long, as it is still open', () => {
    const dialog = modal({ 'data-exiting': '' });
    render(<Speaker message="Deleted" />);
    act(() => vi.advanceTimersByTime(9900));
    expect(liveIn(dialog)).toBeNull();
    // Its new region still sits empty for one moment.
    act(() => vi.advanceTimersByTime(100));
    expect(liveIn(dialog)?.textContent).toBe('');
    act(() => vi.advanceTimersByTime(100));
    expect(liveIn(dialog)?.textContent).toBe('Deleted');
    expect(bodyLive().textContent).toBe('');
  });

  it('waits a moment before writing in a dialog that closed and opened again', () => {
    const dialog = modal();
    const { rerender } = render(<Speaker message="Saved" />);
    act(() => vi.advanceTimersByTime(200));
    expect(liveIn(dialog)?.textContent).toBe('Saved');
    dialog.removeAttribute('open');
    rerender(<Speaker message="Closed" />);
    dialog.setAttribute('open', '');
    act(() => vi.advanceTimersByTime(100));
    expect(liveIn(dialog)?.textContent).toBe('');
    act(() => vi.advanceTimersByTime(100));
    expect(liveIn(dialog)?.textContent).toBe('Closed');
  });

  it('writes in the modal shown last when several are open', () => {
    const behind = modal();
    const front = modal();
    render(<Speaker message="Saved" />);
    act(() => vi.advanceTimersByTime(200));
    expect(liveIn(front)?.textContent).toBe('Saved');
    expect(liveIn(behind)).toBeNull();
  });

  it('ignores an open modal outside the stack', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);
    render(<Speaker message="Saved" />);
    act(() => vi.advanceTimersByTime(100));
    expect(bodyLive().textContent).toBe('Saved');
    expect(liveIn(dialog)).toBeNull();
  });

  it('lets a newer message win after the region was removed', () => {
    const { rerender } = render(<Speaker message="Loading" />);
    for (const node of regions()) node.remove();
    rerender(<Speaker message="Loaded" />);
    act(() => vi.advanceTimersByTime(500));
    expect(bodyLive().textContent).toBe('Loaded');
  });

  it('hides the region with inline styles too', () => {
    render(<Speaker />);
    const region = document.querySelector<HTMLElement>('[data-todae-announcer]')!;
    expect(region.style.position).toBe('absolute');
    expect(region.style.overflow).toBe('hidden');
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
