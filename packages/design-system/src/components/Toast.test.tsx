import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { heldModals } from '../overlay/modalStack';
import { useModalLayer } from '../hooks/useModalLayer';
import { Dialog } from './Dialog';
import { matchesHotkey, Toast, type ToastRegionProps } from './Toast';
import { createToaster, type Toaster } from './toaster';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Region({ toaster, ...props }: { toaster: Toaster } & Partial<ToastRegionProps>) {
  return (
    <Toast.Region toaster={toaster} {...props}>
      {(toast) => (
        <Toast.Root>
          <Toast.Title>{toast.title}</Toast.Title>
          <Toast.Action>Undo</Toast.Action>
          <Toast.Close />
        </Toast.Root>
      )}
    </Toast.Region>
  );
}

describe('Toast', () => {
  it('renders nothing but its home on the server', () => {
    const html = renderToString(<Region toaster={createToaster()} />);
    expect(html).not.toContain('<section');
  });

  it('renders a named region with a polite live list, before any toast', () => {
    render(<Region toaster={createToaster()} aria-label="알림" />);
    const region = screen.getByRole('region', { name: '알림' });
    expect(region.querySelector('ol')?.getAttribute('aria-live')).toBe('polite');
    expect(region.closest('[popover]')?.getAttribute('popover')).toBe('manual');
  });

  it('takes the tone from the toast, and role alert only for critical', () => {
    const toaster = createToaster();
    render(<Region toaster={toaster} />);
    act(() => {
      toaster.add({ title: 'Saved', tone: 'success' });
      toaster.add({ title: 'Failed', tone: 'critical' });
    });
    const saved = screen.getByText('Saved').parentElement!;
    expect(saved.dataset.tone).toBe('success');
    expect(saved.getAttribute('role')).toBeNull();
    expect(screen.getByRole('alert').dataset.tone).toBe('critical');
  });

  it('lists the newest first', () => {
    const toaster = createToaster();
    render(<Region toaster={toaster} />);
    act(() => {
      toaster.add({ title: 'Old' });
      toaster.add({ title: 'New' });
    });
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('New'),
      expect.stringContaining('Old'),
    ]);
  });

  it('dismisses from Close and from Action unless the action prevents it', () => {
    const toaster = createToaster();
    function Keep() {
      return (
        <Toast.Region toaster={toaster}>
          {(toast) => (
            <Toast.Root>
              <Toast.Title>{toast.title}</Toast.Title>
              <Toast.Action onClick={(event) => toast.title === 'Keep' && event.preventDefault()}>Act</Toast.Action>
              <Toast.Close>Got it</Toast.Close>
            </Toast.Root>
          )}
        </Toast.Region>
      );
    }
    render(<Keep />);
    act(() => void toaster.add({ id: 'k', title: 'Keep' }));
    fireEvent.click(screen.getByRole('button', { name: 'Act' }));
    expect(toaster.getSnapshot()[0]!.open).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(toaster.getSnapshot()[0]?.open ?? false).toBe(false);
  });

  it('names Close "Dismiss" unless its text names it', () => {
    const toaster = createToaster();
    render(<Region toaster={toaster} />);
    act(() => void toaster.add({ title: 'A' }));
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('dismisses after its duration, and waiting toasts show when one leaves', () => {
    vi.useFakeTimers();
    const toaster = createToaster({ duration: 1000 });
    render(<Region toaster={toaster} limit={1} />);
    act(() => {
      toaster.add({ title: 'First' });
      toaster.add({ title: 'Second', duration: Infinity });
    });
    expect(screen.queryByText('Second')).toBeNull();
    act(() => void vi.advanceTimersByTime(1000));
    expect(toaster.getSnapshot()[0]!.open).toBe(false);
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('removes a toast dismissed while it waited', () => {
    const toaster = createToaster();
    render(<Region toaster={toaster} limit={1} />);
    act(() => {
      toaster.add({ title: 'Shown' });
      toaster.dismiss(toaster.add({ title: 'Waiting' }));
    });
    expect(toaster.getSnapshot().map((t) => t.title)).toEqual(['Shown']);
  });

  it('pauses the timer while the pointer is over the region', () => {
    vi.useFakeTimers();
    const toaster = createToaster({ duration: 1000 });
    render(<Region toaster={toaster} />);
    act(() => void toaster.add({ title: 'Hold' }));
    const region = screen.getByRole('region');
    act(() => void vi.advanceTimersByTime(600));
    fireEvent.pointerEnter(region);
    act(() => void vi.advanceTimersByTime(2000));
    expect(toaster.getSnapshot()[0]!.open).toBe(true);
    fireEvent.pointerLeave(region);
    // The rest of the time, not all of it again.
    act(() => void vi.advanceTimersByTime(300));
    expect(toaster.getSnapshot()[0]!.open).toBe(true);
    act(() => void vi.advanceTimersByTime(150));
    expect(toaster.getSnapshot()[0]!.open).toBe(false);
  });

  it('marks the region expanded while focus is inside', () => {
    const toaster = createToaster();
    render(<Region toaster={toaster} layout="stack" />);
    act(() => void toaster.add({ title: 'A' }));
    const region = screen.getByRole('region');
    expect(region.dataset.layout).toBe('stack');
    act(() => screen.getByRole('button', { name: 'Undo' }).focus());
    expect(region.hasAttribute('data-expanded')).toBe(true);
    act(() => screen.getByRole('button', { name: 'Undo' }).blur());
    expect(region.hasAttribute('data-expanded')).toBe(false);
  });

  it('moves into the front modal of the stack and back', async () => {
    const toaster = createToaster();
    function Page() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            Close
          </button>
          <Dialog.Root open={open} onOpenChange={setOpen} aria-label="d">
            d
          </Dialog.Root>
          <Region toaster={toaster} />
        </>
      );
    }
    render(<Page />);
    const dialog = screen.getByRole('dialog');
    const host = screen.getByRole('region', { hidden: true }).parentElement!;
    expect(dialog.contains(host)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
    // Still inside while the exit motion runs and the page is inert.
    expect(dialog.contains(host)).toBe(true);
    await waitFor(() => expect(dialog.contains(host)).toBe(false));
    expect(host.hasAttribute('data-popover-open')).toBe(true);
  });
});

describe('useModalLayer', () => {
  it('holds a dialog of your own while open and shown modally', async () => {
    function Own({ open }: { open: boolean }) {
      const ref = useRef<HTMLDialogElement>(null);
      useModalLayer(ref, open);
      return <dialog ref={ref} aria-label="own" />;
    }
    const { rerender } = render(<Own open />);
    const dialog = screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement;
    expect(heldModals()).toHaveLength(0);
    dialog.showModal();
    await act(async () => undefined);
    expect(heldModals()).toEqual([dialog]);
    dialog.close();
    await act(async () => undefined);
    expect(heldModals()).toHaveLength(0);
    dialog.showModal();
    await act(async () => undefined);
    rerender(<Own open={false} />);
    expect(heldModals()).toHaveLength(0);
    dialog.close();
  });
});

describe('matchesHotkey', () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);
  it('matches the key with exactly the named modifiers', () => {
    expect(matchesHotkey(key({ key: 'F8', code: 'F8' }), 'F8')).toBe(true);
    expect(matchesHotkey(key({ key: 'F8', code: 'F8', shiftKey: true }), 'F8')).toBe(false);
    expect(matchesHotkey(key({ key: 't', code: 'KeyT', altKey: true }), 'Alt+T')).toBe(true);
    // Option+T types a dagger on macOS; the code still says T.
    expect(matchesHotkey(key({ key: '†', code: 'KeyT', altKey: true }), 'alt+t')).toBe(true);
    expect(matchesHotkey(key({ key: 't', code: 'KeyT', ctrlKey: true }), 'Control+T')).toBe(true);
    expect(matchesHotkey(key({ key: 't', code: 'KeyT' }), 'Alt+T')).toBe(false);
  });

  it('ignores a keydown with no key, as Chrome sends for an autofill pick', () => {
    const event = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false } as unknown as KeyboardEvent;
    expect(matchesHotkey(event, 'F8')).toBe(false);
  });
});
