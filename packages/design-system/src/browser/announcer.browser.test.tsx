import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAnnouncer } from '../hooks/useAnnouncer';
import { Dialog } from '../components/Dialog';

afterEach(() => {
  // Drop writes still pending, so none lands in a later test.
  const pending = (globalThis as unknown as Record<symbol, Record<string, ReturnType<typeof setTimeout>> | undefined>)[
    Symbol.for('todae.announcer.pending')
  ];
  for (const [key, id] of Object.entries(pending ?? {})) {
    clearTimeout(id);
    delete pending![key];
  }
  for (const node of document.querySelectorAll('[data-todae-announcer]')) node.remove();
});

const politeIn = (host: Element) =>
  host.querySelector<HTMLElement>(':scope > [data-todae-announcer] > [aria-live="polite"]');

function Saver({ message = 'Draft saved', label = 'Save' }: { message?: string; label?: string }) {
  const announce = useAnnouncer();
  return (
    <button type="button" onClick={() => announce(message)}>
      {label}
    </button>
  );
}

describe('useAnnouncer in a browser', () => {
  it('reads a message from inside an open modal dialog', async () => {
    render(
      <Dialog.Root open onOpenChange={() => undefined} aria-label="Edit">
        <Saver />
      </Dialog.Root>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit' });
    act(() => screen.getByRole('button', { name: 'Save' }).click());
    await expect.poll(() => politeIn(dialog)?.textContent).toBe('Draft saved');
    expect(politeIn(document.body)?.textContent).toBe('');
  });

  it('writes in body once a closing dialog has finished its exit, not in the closed dialog', async () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <Saver message="Deleted" label="Delete" />
          <Dialog.Root open={open} onOpenChange={() => undefined} aria-label="Confirm">
            <p>Delete?</p>
          </Dialog.Root>
        </>
      );
    }
    const { rerender } = render(<Harness open />);
    const dialog = screen.getByRole('dialog', { name: 'Confirm' }) as HTMLDialogElement;
    rerender(<Harness open={false} />);
    // While the dialog runs its exit, the page behind it is still inert.
    act(() => screen.getByRole('button', { name: 'Delete', hidden: true }).click());
    await expect.poll(() => politeIn(document.body)?.textContent).toBe('Deleted');
    expect(dialog.open).toBe(false);
    expect(politeIn(dialog)?.textContent ?? '').toBe('');
  });

  it('reads from the dialog opened last when dialogs are nested', async () => {
    function Nested({ inner }: { inner: boolean }) {
      return (
        <Dialog.Root open onOpenChange={() => undefined} aria-label="Outer">
          <Dialog.Root open={inner} onOpenChange={() => undefined} aria-label="Inner">
            <Saver />
          </Dialog.Root>
        </Dialog.Root>
      );
    }
    const { rerender } = render(<Nested inner={false} />);
    rerender(<Nested inner />);
    const inner = screen.getByRole('dialog', { name: 'Inner' });
    const outer = screen.getByRole('dialog', { name: 'Outer', hidden: true });
    act(() => screen.getByRole('button', { name: 'Save' }).click());
    await expect.poll(() => politeIn(inner)?.textContent).toBe('Draft saved');
    expect(politeIn(outer)).toBeNull();
  });

  it('does not treat a non-modal dialog marked aria-modal as modal', async () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);
    dialog.show();
    try {
      render(<Saver />);
      act(() => screen.getByRole('button', { name: 'Save' }).click());
      await expect.poll(() => politeIn(document.body)?.textContent).toBe('Draft saved');
      expect(politeIn(dialog)).toBeNull();
    } finally {
      dialog.remove();
    }
  });

  it('stays visually hidden from inline styles', () => {
    render(<Saver />);
    const region = document.querySelector<HTMLElement>('[data-todae-announcer]')!;
    const style = getComputedStyle(region);
    expect(style.position).toBe('absolute');
    expect(style.width).toBe('1px');
    expect(style.overflow).toBe('hidden');
  });
});
