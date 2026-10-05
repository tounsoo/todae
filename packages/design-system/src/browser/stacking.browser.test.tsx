import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useRef, useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet, type SheetCloseReason } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { OptionList } from '../components/OptionList';
import { Popover } from '../components/Popover';
import { Tooltip } from '../components/Tooltip';
import { usePopover } from '../hooks/usePopover';
import { useTooltip } from '../hooks/useTooltip';

function Themed({ children }: { children: ReactNode }) {
  return (
    <div data-appearance="light" data-density="comfortable">
      {children}
    </div>
  );
}

function DialogWithPopover({ onDialogClose }: { onDialogClose: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const popover = usePopover({ open: menuOpen, onOpenChange: (next) => setMenuOpen(next) });
  return (
    <Themed>
      <Button.Root ref={opener} onClick={() => setDialogOpen(true)}>
        Edit
      </Button.Root>
      <Dialog.Root
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) onDialogClose();
        }}
      >
        <Dialog.Title>Edit</Dialog.Title>
        <Button.Root {...popover.getTriggerProps()}>More</Button.Root>
        <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="More actions">
          <button type="button">Duplicate</button>
        </Popover.Root>
      </Dialog.Root>
    </Themed>
  );
}

describe('stacked overlays in a browser', () => {
  it('closes the innermost overlay first on Escape, then restores focus', async () => {
    const onDialogClose = vi.fn();
    render(<DialogWithPopover onDialogClose={onDialogClose} />);
    const opener = screen.getByRole('button', { name: 'Edit' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Edit' }) as HTMLDialogElement;
    await waitFor(() => expect(dialog.matches(':modal')).toBe(true));

    const more = screen.getByRole('button', { name: 'More' });
    await userEvent.click(more);
    const menu = screen.getByRole('dialog', { name: 'More actions', hidden: true });
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(false));
    expect(onDialogClose).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onDialogClose).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(dialog.open).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

function EdgePopover() {
  const [open, setOpen] = useState(false);
  const popover = usePopover({ open, onOpenChange: (next) => setOpen(next) });
  return (
    <Themed>
      <div style={{ position: 'fixed', bottom: 8, left: 40 }}>
        <Button.Root {...popover.getTriggerProps()}>Low</Button.Root>
      </div>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Low panel">
        <div style={{ height: 160 }}>Tall content</div>
      </Popover.Root>
    </Themed>
  );
}

function EdgeTooltip() {
  const tooltip = useTooltip();
  return (
    <Themed>
      <div style={{ position: 'fixed', top: 4, left: 40 }}>
        <Button.Root tooltip={false} {...tooltip.getTriggerProps()}>
          High
        </Button.Root>
      </div>
      <Tooltip.Root {...tooltip.getTooltipProps()}>Shown below when there is no room above</Tooltip.Root>
    </Themed>
  );
}

describe('anchored placement in a browser', () => {
  it('flips a popover above its trigger near the bottom edge', async () => {
    render(<EdgePopover />);
    const trigger = screen.getByRole('button', { name: 'Low' });
    await userEvent.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'Low panel' });
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(true));
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    expect(p.bottom).toBeLessThanOrEqual(t.top);
    expect(p.bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  it('flips a tooltip below its trigger near the top edge', async () => {
    render(<EdgeTooltip />);
    const trigger = screen.getByRole('button', { name: 'High' });
    await userEvent.hover(trigger);
    const tip = await screen.findByRole('tooltip');
    await waitFor(() => expect(tip.getBoundingClientRect().height).toBeGreaterThan(0));
    const t = trigger.getBoundingClientRect();
    const r = tip.getBoundingClientRect();
    expect(r.top).toBeGreaterThanOrEqual(t.bottom);
    expect(r.top).toBeGreaterThanOrEqual(0);
  });
});

function DraggableSheet({ onClose }: { onClose: (reason: SheetCloseReason) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Themed>
      <div data-testid="floor" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 4 }} />
      <BottomSheet.Root
        open={open}
        onOpenChange={(next, reason) => {
          setOpen(next);
          if (!next) onClose(reason);
        }}
      >
        <BottomSheet.Title>Filters</BottomSheet.Title>
        <BottomSheet.Body>Drag me down</BottomSheet.Body>
      </BottomSheet.Root>
    </Themed>
  );
}

describe('BottomSheet drag in a browser', () => {
  it('dismisses when its grabber is dragged to the bottom', async () => {
    const onClose = vi.fn();
    render(<DraggableSheet onClose={onClose} />);
    const grabber = await screen.findByRole('button', { name: 'Resize sheet' });
    await waitFor(() => expect(grabber.getBoundingClientRect().height).toBeGreaterThan(0));
    await userEvent.dragAndDrop(grabber, screen.getByTestId('floor'));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('drag'));
  });
});

describe('OptionList in a browser', () => {
  it('hides when given the hidden attribute', () => {
    render(
      <Themed>
        <OptionList.Root aria-label="Fruit" hidden>
          <OptionList.Option value="apple">Apple</OptionList.Option>
        </OptionList.Root>
      </Themed>,
    );
    const list = screen.getByRole('listbox', { hidden: true });
    expect(getComputedStyle(list).display).toBe('none');
  });
});
