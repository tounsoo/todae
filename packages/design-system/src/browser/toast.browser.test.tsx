import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from '../components/BottomSheet';
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

function isPopoverShown(el: Element): boolean {
  return el.matches(':popover-open');
}

function hostOf(el: Element): HTMLElement {
  return el.closest('[popover]') as HTMLElement;
}

/** A region whose toasts have one action, "Close it", that calls `onClose` and stays. */
function ClosingRegion({ toaster, onClose }: { toaster: Toaster; onClose: () => void }) {
  return (
    <Toast.Region toaster={toaster}>
      {(toast) => (
        <Toast.Root>
          <Toast.Title>{toast.title}</Toast.Title>
          <Toast.Action
            onClick={(event) => {
              event.preventDefault();
              onClose();
            }}
          >
            Close it
          </Toast.Action>
        </Toast.Root>
      )}
    </Toast.Region>
  );
}

/** Adds a toast inside the open `dialog`, focuses its action by keyboard and presses it. */
async function closeFromToast(toaster: Toaster, dialog: HTMLDialogElement): Promise<HTMLElement> {
  await waitFor(() => expect(dialog.matches(':modal')).toBe(true));
  act(() => void toaster.add({ title: 'Saved' }));
  const action = await screen.findByRole('button', { name: 'Close it' });
  await waitFor(() => expect(dialog.contains(action)).toBe(true));
  await userEvent.keyboard('{F8}');
  await userEvent.tab();
  expect(document.activeElement).toBe(action);
  await userEvent.keyboard('{Enter}');
  return action;
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

  it('keeps keyboard focus on a toast whose action closes the dialog', async () => {
    const toaster = createToaster({ duration: Infinity });
    function Page() {
      const [open, setOpen] = useState(true);
      return (
        <Themed>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Title>Edit</Dialog.Title>
          </Dialog.Root>
          <ClosingRegion toaster={toaster} onClose={() => setOpen(false)} />
        </Themed>
      );
    }
    render(<Page />);
    const dialog = screen.getByRole('dialog', { name: 'Edit' }) as HTMLDialogElement;
    const action = await closeFromToast(toaster, dialog);
    await waitFor(() => expect(dialog.open).toBe(false));
    await waitFor(() => expect(dialog.contains(action)).toBe(false));
    expect(document.activeElement).toBe(action);
  });

  it('keeps keyboard focus on a toast whose action closes a bottom sheet', async () => {
    const toaster = createToaster({ duration: Infinity });
    function Page() {
      const [open, setOpen] = useState(true);
      return (
        <Themed>
          <BottomSheet.Root open={open} onOpenChange={setOpen}>
            <BottomSheet.Title>Sheet</BottomSheet.Title>
          </BottomSheet.Root>
          <ClosingRegion toaster={toaster} onClose={() => setOpen(false)} />
        </Themed>
      );
    }
    render(<Page />);
    const sheet = screen.getByRole('dialog', { name: 'Sheet' }) as HTMLDialogElement;
    const action = await closeFromToast(toaster, sheet);
    await waitFor(() => expect(sheet.isConnected).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(action));
    expect(isPopoverShown(hostOf(action))).toBe(true);
  });

  it('keeps keyboard focus on a toast whose action unmounts a dialog of your own', async () => {
    const toaster = createToaster({ duration: Infinity });
    function Own({ onClose }: { onClose: () => void }) {
      const ref = useRef<HTMLDialogElement>(null);
      useModalLayer(ref, true);
      useEffect(() => ref.current?.showModal(), []);
      return (
        <dialog ref={ref} aria-label="Own" onCancel={onClose}>
          Own
        </dialog>
      );
    }
    function Page() {
      const [open, setOpen] = useState(true);
      return (
        <Themed>
          {open && <Own onClose={() => setOpen(false)} />}
          <ClosingRegion toaster={toaster} onClose={() => setOpen(false)} />
        </Themed>
      );
    }
    render(<Page />);
    const dialog = screen.getByRole('dialog', { name: 'Own' }) as HTMLDialogElement;
    const action = await closeFromToast(toaster, dialog);
    await waitFor(() => expect(dialog.isConnected).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(action));
    expect(isPopoverShown(hostOf(action))).toBe(true);
  });

  it('stays in a dialog of your own when React sets its text', async () => {
    const toaster = createToaster({ duration: Infinity });
    let setText: (text: string) => void = () => undefined;
    function Own() {
      const ref = useRef<HTMLDialogElement>(null);
      const [text, set] = useState('One');
      setText = set;
      useModalLayer(ref, true);
      useEffect(() => ref.current?.showModal(), []);
      return (
        <dialog ref={ref} aria-label="Own">
          {text}
        </dialog>
      );
    }
    render(
      <Themed>
        <Own />
        <Region toaster={toaster} />
      </Themed>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Own' }) as HTMLDialogElement;
    await waitFor(() => expect(dialog.matches(':modal')).toBe(true));
    act(() => void toaster.add({ title: 'Kept' }));
    const undo = await screen.findByRole('button', { name: 'Undo Kept' });
    await waitFor(() => expect(dialog.contains(undo)).toBe(true));
    act(() => setText('Two'));
    expect(dialog.textContent).toContain('Two');
    await waitFor(() => expect(dialog.contains(undo)).toBe(true));
    expect(isPopoverShown(hostOf(undo))).toBe(true);
    await waitFor(() => expect(receivesPointer(undo)).toBe(true));
    act(() => dialog.close());
  });

  it('sends focus to a dialog with nothing tabbable left on Escape from the region', async () => {
    const toaster = createToaster({ duration: Infinity });
    let setShown: (shown: boolean) => void = () => undefined;
    function Page() {
      // The control focus came from leaves while focus is in the toasts.
      const [shown, set] = useState(true);
      setShown = set;
      return (
        <Themed>
          <Dialog.Root open onOpenChange={() => undefined}>
            <Dialog.Title>Read only</Dialog.Title>
            {shown && <Button.Root>Once</Button.Root>}
          </Dialog.Root>
          <Region toaster={toaster} />
        </Themed>
      );
    }
    render(<Page />);
    const dialog = screen.getByRole('dialog', { name: 'Read only' }) as HTMLDialogElement;
    await waitFor(() => expect(dialog.matches(':modal')).toBe(true));
    act(() => void toaster.add({ title: 'Note' }));
    const undo = await screen.findByRole('button', { name: 'Undo Note' });
    await waitFor(() => expect(dialog.contains(undo)).toBe(true));
    screen.getByRole('button', { name: 'Once' }).focus();
    await userEvent.keyboard('{F8}');
    expect(document.activeElement).toBe(screen.getByRole('region'));
    act(() => setShown(false));
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(dialog);
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

  it('keeps toasts inside a dialog of your own until it closes after open turns false', async () => {
    const toaster = createToaster({ duration: Infinity });
    // As on the useModalLayer page: close() runs in an effect after open turns false.
    function Own({ open }: { open: boolean }) {
      const ref = useRef<HTMLDialogElement>(null);
      useModalLayer(ref, open);
      useEffect(() => {
        if (open) ref.current?.showModal();
        else ref.current?.close();
      }, [open]);
      return (
        <dialog ref={ref} aria-label="Own">
          <p>Own</p>
        </dialog>
      );
    }
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <Themed>
          <Button.Root onClick={() => setOpen(true)}>Open own</Button.Root>
          <Own open={open} />
          <ClosingRegion toaster={toaster} onClose={() => setOpen(false)} />
        </Themed>
      );
    }
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Open own' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Own' }) as HTMLDialogElement;
    const action = await closeFromToast(toaster, dialog);
    await waitFor(() => expect(dialog.open).toBe(false));
    await waitFor(() => expect(dialog.contains(action)).toBe(false));
    // close() returns focus to the opener, as natively, not to the page.
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('stays in front of a dialog of your own that is shown again', async () => {
    const toaster = createToaster({ duration: Infinity });
    function Own() {
      const ref = useRef<HTMLDialogElement>(null);
      useModalLayer(ref, true);
      useEffect(() => ref.current?.showModal(), []);
      return (
        <dialog ref={ref} aria-label="Own">
          <p>Own</p>
        </dialog>
      );
    }
    render(
      <Themed>
        <Own />
        <Region toaster={toaster} />
      </Themed>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Own' }) as HTMLDialogElement;
    await waitFor(() => expect(dialog.matches(':modal')).toBe(true));
    act(() => void toaster.add({ title: 'Front' }));
    const undo = await screen.findByRole('button', { name: 'Undo Front' });
    await waitFor(() => expect(receivesPointer(undo)).toBe(true));
    // Shown again in one task: the stack sees one change, the top layer two.
    dialog.close();
    dialog.showModal();
    await waitFor(() => expect(receivesPointer(undo)).toBe(true));
    act(() => dialog.close());
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

  it('gives a dialog with nothing tabbable its own focus, not a toast\'s', async () => {
    const toaster = createToaster({ duration: Infinity });
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <Themed>
          <Button.Root onClick={() => setOpen(true)}>Open</Button.Root>
          <Dialog.Root open={open} onOpenChange={setOpen} aria-label="Working">
            Saving your changes.
          </Dialog.Root>
          <Region toaster={toaster} />
        </Themed>
      );
    }
    render(<Page />);
    act(() => void toaster.add({ title: 'Earlier' }));
    const undo = await screen.findByRole('button', { name: 'Undo Earlier' });
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Working' }) as HTMLDialogElement;
    await waitFor(() => expect(dialog.contains(undo)).toBe(true));
    expect(document.activeElement).not.toBe(undo);
    expect(dialog.contains(document.activeElement)).toBe(true);
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
    // The hotkey can't reach it either, so the key stays the page's.
    const key = new KeyboardEvent('keydown', { key: 'F8', code: 'F8', bubbles: true, cancelable: true });
    screen.getByTestId('raw').dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
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

  it('keeps the gap between listed toasts inside the region', async () => {
    const toaster = createToaster({ duration: Infinity });
    render(
      <Themed>
        <Region toaster={toaster} />
      </Themed>,
    );
    act(() => {
      toaster.add({ title: 'Upper' });
      toaster.add({ title: 'Lower' });
    });
    await screen.findByRole('button', { name: 'Undo Upper' });
    const [newer, older] = [...document.querySelectorAll('ol > li')].map((item) => item.getBoundingClientRect());
    // Bottom placement: the older toast sits above the newer one.
    const y = (older!.bottom + newer!.top) / 2;
    expect(newer!.top - older!.bottom).toBeGreaterThan(0);
    const hit = document.elementFromPoint(newer!.left + newer!.width / 2, y);
    expect(screen.getByRole('region').contains(hit)).toBe(true);
    // Nothing past the farthest toast covers the page.
    const above = document.elementFromPoint(older!.left + older!.width / 2, older!.top - 2);
    expect(screen.getByRole('region').contains(above)).toBe(false);
  });

  it('keeps timing the others after a mouse click dismisses one', async () => {
    const toaster = createToaster({ duration: 400 });
    render(
      <Themed>
        <button type="button">Away</button>
        <Region toaster={toaster} />
      </Themed>,
    );
    act(() => {
      toaster.add({ title: 'Stays', duration: 600 });
      toaster.add({ title: 'Goes', duration: Infinity });
    });
    await screen.findByRole('button', { name: 'Undo Goes' });
    const goes = screen.getByText('Goes', { selector: 'p' }).closest('li')!;
    await userEvent.click(goes.querySelector('button[aria-label="Dismiss"]')!);
    await userEvent.hover(screen.getByRole('button', { name: 'Away' }));
    await waitFor(() => expect(toaster.getSnapshot()).toHaveLength(0), { timeout: 3000 });
  });

  it('keeps timing after a click on a toast\'s text once the pointer leaves', async () => {
    const toaster = createToaster({ duration: 400 });
    render(
      <Themed>
        <button type="button">Away</button>
        <Region toaster={toaster} />
      </Themed>,
    );
    act(() => void toaster.add({ title: 'Read me', duration: 1500 }));
    await userEvent.click(await screen.findByText('Read me', { selector: 'p' }));
    await userEvent.hover(screen.getByRole('button', { name: 'Away' }));
    await waitFor(() => expect(toaster.getSnapshot()).toHaveLength(0), { timeout: 3000 });
  });

  it('keeps timing after the toast under a resting pointer is removed', async () => {
    const toaster = createToaster({ duration: Infinity });
    render(
      <Themed>
        <Region toaster={toaster} />
      </Themed>,
    );
    let goes = '';
    act(() => {
      goes = toaster.add({ title: 'Goes' });
      toaster.add({ title: 'Stays', duration: 400 });
    });
    // The older toast sits furthest from the corner, so nothing slides under
    // the pointer once it is gone.
    await userEvent.hover(await screen.findByText('Goes', { selector: 'p' }));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(toaster.getSnapshot()).toHaveLength(2);
    act(() => toaster.remove(goes));
    await waitFor(() => expect(toaster.getSnapshot()).toHaveLength(0), { timeout: 3000 });
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

  it('keeps focus in the toasts while a new one shows, without visiting the page', async () => {
    const toaster = createToaster({ duration: Infinity });
    render(
      <Themed>
        <button type="button">Before</button>
        <Region toaster={toaster} />
      </Themed>,
    );
    const before = screen.getByRole('button', { name: 'Before' });
    before.focus();
    // Shown while Before has focus, which hiding the popover would go back to.
    act(() => void toaster.add({ title: 'One' }));
    await screen.findByRole('button', { name: 'Undo One' });
    await userEvent.keyboard('{F8}');
    await userEvent.tab();
    const undo = screen.getByRole('button', { name: 'Undo One' });
    expect(document.activeElement).toBe(undo);
    const visits = vi.fn();
    before.addEventListener('focus', visits);
    act(() => void toaster.add({ title: 'Two' }));
    await screen.findByRole('button', { name: 'Undo Two' });
    expect(visits).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(undo);
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
