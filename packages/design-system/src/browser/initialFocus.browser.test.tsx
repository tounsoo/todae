import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { BottomSheet } from '../components/BottomSheet.js';
import { Button } from '../components/Button.js';
import { Dialog } from '../components/Dialog.js';
import { Drawer } from '../components/Drawer.js';
import { Popover } from '../components/Popover.js';
import { usePopover } from '../hooks/usePopover.js';

afterEach(cleanup);

type Kind = 'Dialog' | 'Drawer' | 'BottomSheet';
const shells = { Dialog, Drawer, BottomSheet } as const;

function ModalHarness({ kind }: { kind: Kind }) {
  const [open, setOpen] = useState(false);
  const target = useRef<HTMLInputElement>(null);
  const Shell = shells[kind];
  return (
    <div data-appearance="light" data-density="comfortable">
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Shell.Root open={open} onOpenChange={setOpen} initialFocusRef={target}>
        <Shell.Title>Rename</Shell.Title>
        <button type="button">First</button>
        <input aria-label="Name" ref={target} />
      </Shell.Root>
    </div>
  );
}

function PopoverHarness() {
  const [open, setOpen] = useState(false);
  const target = useRef<HTMLInputElement>(null);
  const popover = usePopover({ open, onOpenChange: (next) => setOpen(next), initialFocusRef: target });
  return (
    <div data-appearance="light" data-density="comfortable">
      <Button.Root {...popover.getTriggerProps()}>Open</Button.Root>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Rename">
        <button type="button">First</button>
        <input aria-label="Name" ref={target} />
      </Popover.Root>
    </div>
  );
}

describe('initialFocusRef on an overlay opened after mount', () => {
  it.each<Kind>(['Dialog', 'Drawer', 'BottomSheet'])('%s focuses the ref, not its first control', async (kind) => {
    render(<ModalHarness kind={kind} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(document.querySelector('dialog')?.matches(':modal')).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' })));
  });

  it('Popover focuses the ref, not its first control', async () => {
    render(<PopoverHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Rename' }).matches(':popover-open')).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' })));
  });
});

describe('initial focus in a modal opened from another modal', () => {
  it('lands on the first control of a Dialog mounted open beside the one it opens from', async () => {
    function Stacked() {
      const [second, setSecond] = useState(false);
      return (
        <div data-appearance="light" data-density="comfortable">
          <Dialog.Root open onOpenChange={() => undefined}>
            <Dialog.Title>Rename</Dialog.Title>
            <button type="button" onClick={() => setSecond(true)}>
              Delete
            </button>
          </Dialog.Root>
          {second && (
            <Dialog.Root open onOpenChange={setSecond}>
              <Dialog.Title>Confirm</Dialog.Title>
              <button type="button">Keep</button>
            </Dialog.Root>
          )}
        </div>
      );
    }
    render(<Stacked />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep' })));
  });
});
