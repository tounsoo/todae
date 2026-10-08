import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useRef, useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Popover } from '../components/Popover';
import { Toast, type ToastLayout } from '../components/Toast';
import { createToaster, type Toaster } from '../components/toaster';
import { useModalLayer } from '../hooks/useModalLayer';
import { usePopover } from '../hooks/usePopover';

function Themed({ children }: { children: ReactNode }) {
  return (
    <div data-appearance="light" data-density="comfortable">
      {children}
    </div>
  );
}

function Region({ toaster, layout = 'list', limit }: { toaster: Toaster; layout?: ToastLayout; limit?: number }) {
  return (
    <Toast.Region toaster={toaster} layout={layout} limit={limit}>
      {(toast) => (
        <Toast.Root>
          <Toast.Title>{toast.title}</Toast.Title>
          <Toast.Action onClick={() => undefined}>Undo {String(toast.title)}</Toast.Action>
          <Toast.Close />
        </Toast.Root>
      )}
    </Toast.Region>
  );
}

/** The element a click at the middle of `el` lands on is `el` or inside it. */
function receivesPointer(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return Boolean(hit && el.contains(hit));
}

function canFocus(el: HTMLElement): boolean {
  el.focus();
  return document.activeElement === el;
}

function hostOf(el: Element): HTMLElement {
  return el.closest('[popover]') as HTMLElement;
}

function DialogPage({ toaster }: { toaster: Toaster }) {
  const [open, setOpen] = useState(false);
  return (
    <Themed>
      <Button.Root onClick={() => setOpen(true)}>Open</Button.Root>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Title>Edit</Dialog.Title>
        <Button.Root onClick={() => toaster.add({ title: 'Inside' })}>Notify</Button.Root>
      </Dialog.Root>
      <Region toaster={toaster} />
    </Themed>
  );
}

describe('Toast with a modal dialog', () => {
  it('moves a toast shown before the dialog above it, and back when it closes', async () => {
    const toaster = createToaster({ duration: Infinity });
    render(<DialogPage toaster={toaster} />);
    act(() => void toaster.add({ title: 'Before' }));
    const undo = await screen.findByRole('button', { name: 'Undo Before' });
    await waitFor(() => expect(receivesPointer(undo)).toBe(true));

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit' }) as HTMLDialogElement;
    await waitFor(() => expect(dialog.matches(':modal')).toBe(true));
    await waitFor(() => expect(dialog.contains(undo)).toBe(true));
    expect(hostOf(undo).matches(':popover-open')).toBe(true);
    await waitFor(() => expect(receivesPointer(undo)).toBe(true));
    expect(canFocus(undo)).toBe(true);

    // Escape from the dialog's own content closes the dialog, not the toast.
    screen.getByRole('button', { name: 'Notify' }).focus();
    await userEvent.keyboard('{Escape}');
    // Through the exit motion the page is still inert, so the toast stays in
    // the dialog, usable, and does not fade with it.
    await waitFor(() => expect(dialog.hasAttribute('data-exiting')).toBe(true));
    expect(dialog.contains(undo)).toBe(true);
    expect(receivesPointer(undo)).toBe(true);
    expect(getComputedStyle(undo.closest('li')!).opacity).toBe('1');
    await waitFor(() => expect(dialog.contains(undo)).toBe(false));
    expect(hostOf(undo).matches(':popover-open')).toBe(true);
    await waitFor(() => expect(dialog.open).toBe(false));
    expect(receivesPointer(undo)).toBe(true);
  });

  it('shows a toast added while the dialog is open above it and usable', async () => {
    const toaster = createToaster({ duration: Infinity });
    render(<DialogPage toaster={toaster} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit' }) as HTMLDialogElement;
    await waitFor(() => expect(dialog.matches(':modal')).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Notify' }));
    const undo = await screen.findByRole('button', { name: 'Undo Inside' });
    expect(dialog.contains(undo)).toBe(true);
    await waitFor(() => expect(receivesPointer(undo)).toBe(true));
    await userEvent.click(undo);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo Inside' })).toBeNull());
    expect(dialog.open).toBe(true);
  });

  it('dismisses the focused toast on Escape without closing the dialog', async () => {
    const toaster = createToaster({ duration: Infinity });
    const onOpenChange = vi.fn();
    function Page() {
      const [open, setOpen] = useState(true);
      return (
        <Themed>
          <Dialog.Root
            open={open}
            onOpenChange={(next) => {
              onOpenChange(next);
              setOpen(next);
            }}
          >
            <Dialog.Title>Edit</Dialog.Title>
          </Dialog.Root>
          <Region toaster={toaster} />
        </Themed>
      );
    }
    render(<Page />);
    const dialog = screen.getByRole('dialog', { name: 'Edit' }) as HTMLDialogElement;
    await waitFor(() => expect(dialog.matches(':modal')).toBe(true));
    act(() => void toaster.add({ title: 'Saved' }));
    const undo = await screen.findByRole('button', { name: 'Undo Saved' });
    await waitFor(() => expect(dialog.contains(undo)).toBe(true));
    undo.focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(toaster.getSnapshot()).toHaveLength(0));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
  });

  it('follows a modal <dialog> of your own through useModalLayer', async () => {
    const toaster = createToaster({ duration: Infinity });
    function Own() {
      const ref = useRef<HTMLDialogElement>(null);
      const [open, setOpen] = useState(false);
      useModalLayer(ref, open);
      return (
        <Themed>
          <button
            type="button"
            onClick={() => {
              ref.current?.showModal();
              setOpen(true);
            }}
          >
            Show own
          </button>
          <dialog ref={ref} aria-label="Own" onClose={() => setOpen(false)}>
            <button type="button" onClick={() => ref.current?.close()}>
              Done
            </button>
          </dialog>
          <Region toaster={toaster} />
        </Themed>
      );
    }
    render(<Own />);
    act(() => void toaster.add({ title: 'Mine' }));
    const undo = await screen.findByRole('button', { name: 'Undo Mine' });
    await userEvent.click(screen.getByRole('button', { name: 'Show own' }));
    const dialog = screen.getByRole('dialog', { name: 'Own' });
    await waitFor(() => expect(dialog.contains(undo)).toBe(true));
    await waitFor(() => expect(receivesPointer(undo)).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(dialog.contains(undo)).toBe(false));
    expect(receivesPointer(undo)).toBe(true);
  });

  it('keeps the dialog\'s own focus to return to, not a toast\'s', async () => {
    const toaster = createToaster({ duration: Infinity });
    function Page() {
      // Ignores closes it did not ask for, so a script's close() shows it again.
      const [open, setOpen] = useState(true);
      return (
        <Themed>
          <Dialog.Root open={open} onOpenChange={(next, reason) => reason !== 'native' && setOpen(next)}>
            <Dialog.Title>Edit</Dialog.Title>
            <Button.Root onClick={() => toaster.add({ title: 'Inside' })}>Notify</Button.Root>
          </Dialog.Root>
          <Region toaster={toaster} />
        </Themed>
      );
    }
    render(<Page />);
    const dialog = screen.getByRole('dialog', { name: 'Edit' }) as HTMLDialogElement;
    await waitFor(() => expect(dialog.matches(':modal')).toBe(true));
    const notify = screen.getByRole('button', { name: 'Notify' });
    await userEvent.click(notify);
    const undo = await screen.findByRole('button', { name: 'Undo Inside' });
    undo.focus();
    dialog.close();
    await waitFor(() => expect(dialog.open).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(notify));
  });

  it('stays inert under a modal that is not in the stack', async () => {
    const toaster = createToaster({ duration: Infinity });
    render(
      <Themed>
        <dialog aria-label="Raw" data-testid="raw" />
        <Region toaster={toaster} />
      </Themed>,
    );
    act(() => void toaster.add({ title: 'Raw' }));
    const undo = await screen.findByRole('button', { name: 'Undo Raw' });
    (screen.getByTestId('raw') as HTMLDialogElement).showModal();
    act(() => void toaster.add({ title: 'Later' }));
    await screen.findByRole('button', { name: 'Undo Later' });
    // Painted on top as the newest popover, yet outside the modal, so inert.
    expect(canFocus(undo)).toBe(false);
    (screen.getByTestId('raw') as HTMLDialogElement).close();
  });
});

describe('Toast in the top layer', () => {
  it('shows a new toast in front of a popover opened before it', async () => {
    const toaster = createToaster({ duration: Infinity });
    function Page() {
      const [open, setOpen] = useState(false);
      const popover = usePopover({ open, onOpenChange: (next) => setOpen(next) });
      return (
        <Themed>
          <Button.Root {...popover.getTriggerProps()}>More</Button.Root>
          <Popover.Root
            {...popover.getPopoverProps()}
            aria-label="Panel"
            role="dialog"
            style={{ position: 'fixed', inset: 'auto 0 0 auto', margin: 0, width: 600, height: 400 }}
          >
            Panel
          </Popover.Root>
          <Region toaster={toaster} />
        </Themed>
      );
    }
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    const panel = screen.getByRole('dialog', { name: 'Panel' });
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(true));
    act(() => void toaster.add({ title: 'Over' }));
    const undo = await screen.findByRole('button', { name: 'Undo Over' });
    await waitFor(() => expect(receivesPointer(undo)).toBe(true));
    expect(panel.matches(':popover-open')).toBe(true);
  });

  it('shows a toast out of the queue in front of a popover opened while it waited', async () => {
    const toaster = createToaster({ duration: Infinity });
    function Page() {
      const [open, setOpen] = useState(false);
      const popover = usePopover({ open, onOpenChange: (next) => setOpen(next) });
      return (
        <Themed>
          <Button.Root {...popover.getTriggerProps()}>More</Button.Root>
          <Popover.Root
            {...popover.getPopoverProps()}
            aria-label="Panel"
            role="dialog"
            style={{ position: 'fixed', inset: 'auto 0 0 auto', margin: 0, width: 600, height: 400 }}
          >
            Panel
          </Popover.Root>
          <Region toaster={toaster} limit={1} />
        </Themed>
      );
    }
    render(<Page />);
    act(() => {
      toaster.add({ id: 'a', title: 'First' });
      toaster.add({ title: 'Queued' });
    });
    await screen.findByRole('button', { name: 'Undo First' });
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    const panel = screen.getByRole('dialog', { name: 'Panel' });
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(true));
    act(() => toaster.dismiss('a'));
    const queued = await screen.findByRole('button', { name: 'Undo Queued' });
    await waitFor(() => expect(receivesPointer(queued)).toBe(true));
  });

  it('keeps timing toasts after the focused one is dismissed', async () => {
    const toaster = createToaster({ duration: 400 });
    render(
      <Themed>
        <Region toaster={toaster} layout="stack" />
      </Themed>,
    );
    act(() => void toaster.add({ title: 'Kept', duration: Infinity }));
    const close = await screen.findByRole('button', { name: 'Dismiss' });
    close.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(toaster.getSnapshot()).toHaveLength(0));
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region.hasAttribute('data-expanded')).toBe(false);
    act(() => void toaster.add({ title: 'Timed' }));
    await screen.findByRole('button', { name: 'Undo Timed' });
    await waitFor(() => expect(toaster.getSnapshot()).toHaveLength(0), { timeout: 2000 });
  });

  it('shows at most limit toasts, and the next one when one leaves', async () => {
    const toaster = createToaster({ duration: Infinity });
    render(
      <Themed>
        <Region toaster={toaster} limit={2} />
      </Themed>,
    );
    act(() => {
      toaster.add({ title: 'A' });
      toaster.add({ title: 'B' });
      toaster.add({ title: 'C' });
    });
    await screen.findByRole('button', { name: 'Undo B' });
    expect(screen.queryByRole('button', { name: 'Undo C' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Undo A' }));
    await screen.findByRole('button', { name: 'Undo C' });
  });

  it('dismisses itself after its duration, paused while hovered', async () => {
    const toaster = createToaster({ duration: 300 });
    render(
      <Themed>
        <Region toaster={toaster} />
      </Themed>,
    );
    act(() => void toaster.add({ title: 'Brief' }));
    const undo = await screen.findByRole('button', { name: 'Undo Brief' });
    await userEvent.hover(undo);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(toaster.getSnapshot()).toHaveLength(1);
    await userEvent.unhover(undo);
    await waitFor(() => expect(toaster.getSnapshot()).toHaveLength(0), { timeout: 2000 });
  });

  it('moves focus to the region on F8 and back after Escape', async () => {
    const toaster = createToaster({ duration: Infinity });
    render(
      <Themed>
        <button type="button">Elsewhere</button>
        <Region toaster={toaster} />
      </Themed>,
    );
    act(() => void toaster.add({ title: 'Keys' }));
    await screen.findByRole('button', { name: 'Undo Keys' });
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    await userEvent.keyboard('{F8}');
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(document.activeElement).toBe(region);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo Keys' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(elsewhere));
  });

  it('stacks toasts behind the newest and spreads them on hover', async () => {
    const toaster = createToaster({ duration: Infinity });
    render(
      <Themed>
        <Region toaster={toaster} layout="stack" />
      </Themed>,
    );
    act(() => {
      toaster.add({ title: 'One' });
      toaster.add({ title: 'Two' });
      toaster.add({ title: 'Three' });
    });
    const newest = await screen.findByRole('button', { name: 'Undo Three' });
    const items = () => [...document.querySelectorAll('ol > li')] as HTMLElement[];
    await waitFor(() => expect(items()).toHaveLength(3));
    // Collapsed: every toast ends within a peek of the newest's bottom edge.
    await waitFor(() => {
      const [front, ...rest] = items().map((item) => item.getBoundingClientRect());
      for (const rect of rest) expect(Math.abs(rect.bottom - front!.bottom)).toBeLessThan(40);
    });
    expect(receivesPointer(newest)).toBe(true);

    await userEvent.hover(newest);
    await waitFor(() => {
      const rects = items().map((item) => item.getBoundingClientRect());
      // Spread: each older toast sits fully above the newer one.
      for (let i = 1; i < rects.length; i++) expect(rects[i]!.bottom).toBeLessThanOrEqual(rects[i - 1]!.top + 1);
    });
  });
});
