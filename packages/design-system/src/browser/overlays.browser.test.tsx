import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { usePopover } from '../hooks/usePopover';
import { Button } from '../components/Button';
import { Dialog, type DialogCloseReason } from '../components/Dialog';
import { Popover } from '../components/Popover';

function Themed({ children }: { children: ReactNode }) {
  return (
    <div data-appearance="light" data-density="comfortable">
      {children}
    </div>
  );
}

function DialogHarness({ onClose }: { onClose: (reason: DialogCloseReason) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Themed>
      <Dialog.Root
        open={open}
        onOpenChange={(next, reason) => {
          setOpen(next);
          if (!next) onClose(reason);
        }}
      >
        <Dialog.Title>Rename</Dialog.Title>
        <form method="dialog">
          <input aria-label="Name" />
          <button type="submit" value="save">
            Save
          </button>
        </form>
      </Dialog.Root>
    </Themed>
  );
}

function dialog(): HTMLDialogElement {
  return screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement;
}

describe('Dialog in a browser', () => {
  it('opens modal in the top layer and moves focus inside', async () => {
    render(<DialogHarness onClose={() => undefined} />);
    await waitFor(() => expect(dialog().matches(':modal')).toBe(true));
    expect(dialog().contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape through onOpenChange, once', async () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    await waitFor(() => expect(dialog().matches(':modal')).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('escape'));
    // The element stays mounted; the exit motion runs, then it closes.
    await waitFor(() => expect(dialog().open).toBe(false));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from a method="dialog" form with the submitter value', async () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    await waitFor(() => expect(dialog().matches(':modal')).toBe(true));
    const el = dialog();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('form'));
    expect(el.returnValue).toBe('save');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click but not on a click inside', async () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    await waitFor(() => expect(dialog().matches(':modal')).toBe(true));
    await userEvent.click(screen.getByRole('textbox', { name: 'Name' }));
    expect(onClose).not.toHaveBeenCalled();
    // The dialog element itself spans the backdrop; its corner is outside the panel.
    await userEvent.click(dialog(), { position: { x: 2, y: 2 } });
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('backdrop'));
  });
});

function PopoverHarness() {
  const [open, setOpen] = useState(false);
  const popover = usePopover({ open, onOpenChange: (next) => setOpen(next) });
  return (
    <Themed>
      <div style={{ padding: 40 }}>
        <Button.Root {...popover.getTriggerProps()}>Filters</Button.Root>
      </div>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Filters panel">
        <button type="button">Apply</button>
      </Popover.Root>
    </Themed>
  );
}

describe('Popover in a browser', () => {
  it('shows in the top layer below its trigger and hides on Escape', async () => {
    render(<PopoverHarness />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'Filters panel' });
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(true));
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    // Anchor positioning places it under the trigger, aligned to its left edge.
    expect(p.top).toBeGreaterThanOrEqual(t.bottom);
    expect(p.top - t.bottom).toBeLessThan(24);
    expect(Math.abs(p.left - t.left)).toBeLessThan(1);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(false));
  });
});
