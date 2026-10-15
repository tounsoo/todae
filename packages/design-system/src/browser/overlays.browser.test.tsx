import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { usePopover } from '../hooks/usePopover';
import { BottomSheet, type SheetCloseReason } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Dialog, type DialogCloseReason } from '../components/Dialog';
import { Drawer } from '../components/Drawer';
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

function PopoverHarness({ dir }: { dir?: 'rtl' }) {
  const [open, setOpen] = useState(false);
  const popover = usePopover({ open, onOpenChange: (next) => setOpen(next) });
  return (
    <Themed>
      <div dir={dir}>
        <div style={{ padding: 40 }}>
          <Button.Root {...popover.getTriggerProps()}>Filters</Button.Root>
        </div>
        <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Filters panel">
          <button type="button">Apply</button>
        </Popover.Root>
      </div>
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
    // Anchor positioning places it under the trigger, aligned to its inline start.
    expect(p.top).toBeGreaterThanOrEqual(t.bottom);
    expect(p.top - t.bottom).toBeLessThan(24);
    expect(Math.abs(p.left - t.left)).toBeLessThan(1);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(false));
  });

  it('aligns to the inline start of its trigger in a right-to-left subtree', async () => {
    render(<PopoverHarness dir="rtl" />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'Filters panel' });
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(true));
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    expect(p.top).toBeGreaterThanOrEqual(t.bottom);
    expect(Math.abs(p.right - t.right)).toBeLessThan(1);
  });
});

function SheetHarness({ onClose }: { onClose: (reason: SheetCloseReason) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div data-appearance="dark" data-density="comfortable" data-testid="host">
      <BottomSheet.Root
        open={open}
        onOpenChange={(next, reason) => {
          setOpen(next);
          if (!next) onClose(reason);
        }}
      >
        <BottomSheet.Title>Sort</BottomSheet.Title>
        <BottomSheet.Body>Newest first</BottomSheet.Body>
      </BottomSheet.Root>
    </div>
  );
}

describe('BottomSheet in a browser', () => {
  const sheet = () => document.querySelector('dialog') as HTMLDialogElement;

  it('opens as a modal dialog in the top layer with the theme of its parent', async () => {
    render(<SheetHarness onClose={() => undefined} />);
    await waitFor(() => expect(sheet().matches(':modal')).toBe(true));
    expect(screen.getByRole('dialog', { name: 'Sort' })).toBe(sheet());
    // Rendered in place, so the dark appearance applies without a portal.
    const host = getComputedStyle(screen.getByTestId('host')).getPropertyValue('--todae-sheet-bg').trim();
    expect(host).not.toBe('');
    expect(getComputedStyle(sheet()).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(sheet(), '::backdrop').backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    // Pinned to the bottom edge, full width, once its enter motion ends.
    await waitFor(() => expect(Math.round(sheet().getBoundingClientRect().bottom)).toBe(window.innerHeight), {
      timeout: 2000,
    });
    // Edge to edge, give or take the gutter the page keeps for its scrollbar while a modal is open.
    const box = sheet().getBoundingClientRect();
    expect(Math.round(box.left)).toBe(0);
    expect(box.width).toBeGreaterThan(window.innerWidth - 24);
  });

  it('leaves room in its scrolling body for the focus ring of a control at its edge', async () => {
    render(
      <Themed>
        <BottomSheet.Root open onOpenChange={() => undefined}>
          <BottomSheet.Title>Filter</BottomSheet.Title>
          <BottomSheet.Body data-testid="body">
            <input aria-label="Filter" style={{ display: 'block', boxSizing: 'border-box', width: '100%' }} />
          </BottomSheet.Body>
        </BottomSheet.Root>
      </Themed>,
    );
    await waitFor(() => expect(sheet().matches(':modal')).toBe(true));
    const body = screen.getByTestId('body');
    const style = getComputedStyle(body);
    const room =
      parseFloat(style.getPropertyValue('--todae-focus-ring-width')) +
      parseFloat(style.getPropertyValue('--todae-focus-ring-offset'));
    expect(room).toBeGreaterThan(0);
    // The body clips at its padding box, so the ring needs that much room on every side.
    const clip = body.getBoundingClientRect();
    const input = screen.getByRole('textbox', { name: 'Filter' }).getBoundingClientRect();
    expect(input.left - room).toBeGreaterThanOrEqual(clip.left);
    expect(input.right + room).toBeLessThanOrEqual(clip.right);
    expect(input.top - room).toBeGreaterThanOrEqual(clip.top);
    // The negative margin gives the room back, so the content keeps the sheet's own padding line.
    const edge = getComputedStyle(sheet());
    const contentLeft = sheet().getBoundingClientRect().left + parseFloat(edge.borderLeftWidth) + parseFloat(edge.paddingLeft);
    expect(input.left).toBeCloseTo(contentLeft, 0);
  });

  it('closes on a scrim click but not on a click on the sheet', async () => {
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    await waitFor(() => expect(sheet().matches(':modal')).toBe(true));
    await userEvent.click(screen.getByText('Newest first'));
    // The sheet's own padding is the dialog element too, but inside its box.
    await userEvent.click(sheet(), { position: { x: 4, y: sheet().getBoundingClientRect().height - 4 } });
    expect(onClose).not.toHaveBeenCalled();
    // Above the sheet is the ::backdrop, which hit-tests as the dialog.
    await userEvent.click(sheet(), { position: { x: 4, y: -20 } });
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('backdrop'));
  });

  it('gives focus back to its trigger once the exit motion ends', async () => {
    function Launcher() {
      const [open, setOpen] = useState(false);
      return (
        <Themed>
          <Button.Root onClick={() => setOpen(true)}>Sort by</Button.Root>
          <BottomSheet.Root open={open} onOpenChange={setOpen}>
            <BottomSheet.Title>Sort</BottomSheet.Title>
            <BottomSheet.Body>
              <BottomSheet.Close>Done</BottomSheet.Close>
            </BottomSheet.Body>
          </BottomSheet.Root>
        </Themed>
      );
    }
    render(<Launcher />);
    const trigger = screen.getByRole('button', { name: 'Sort by' });
    await userEvent.click(trigger);
    await waitFor(() => expect(sheet()?.matches(':modal')).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('dialog')).toBeNull(), { timeout: 2000 });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('takes Escape over a popover left open behind it', async () => {
    const onClose = vi.fn();
    function Stack() {
      const popover = usePopover();
      const [open, setOpen] = useState(false);
      return (
        <Themed>
          <Button.Root {...popover.getTriggerProps()}>Filters</Button.Root>
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Filters panel" data-testid="panel">
            <button type="button" onClick={() => setOpen(true)}>
              More
            </button>
          </Popover.Root>
          <BottomSheet.Root
            open={open}
            onOpenChange={(next, reason) => {
              setOpen(next);
              if (!next) onClose(reason);
            }}
          >
            <BottomSheet.Title>More filters</BottomSheet.Title>
          </BottomSheet.Root>
        </Themed>
      );
    }
    render(<Stack />);
    const panel = screen.getByTestId('panel');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await waitFor(() => expect(sheet()?.matches(':modal')).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('escape'));
    expect(panel.matches(':popover-open')).toBe(true);
  });

  it('warns when it opens inside a hidden container', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <div hidden>
        <SheetHarness onClose={() => undefined} />
      </div>,
    );
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining('hidden container')));
    error.mockRestore();
  });
});

describe('modal headers', () => {
  const cases = [
    [
      'Dialog',
      () => (
        <Dialog.Root open onOpenChange={() => undefined}>
          <Dialog.Header data-testid="header">
            <Dialog.Title>Filters</Dialog.Title>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Header>
        </Dialog.Root>
      ),
    ],
    [
      'Drawer',
      () => (
        <Drawer.Root open onOpenChange={() => undefined}>
          <Drawer.Header data-testid="header">
            <Drawer.Title>Filters</Drawer.Title>
            <Drawer.Close>Close</Drawer.Close>
          </Drawer.Header>
        </Drawer.Root>
      ),
    ],
    [
      'BottomSheet',
      () => (
        <BottomSheet.Root open onOpenChange={() => undefined}>
          <BottomSheet.Header data-testid="header">
            <BottomSheet.Title>Filters</BottomSheet.Title>
            <BottomSheet.Close>Close</BottomSheet.Close>
          </BottomSheet.Header>
        </BottomSheet.Root>
      ),
    ],
  ] as const;

  it.each(cases)('puts the %s title and close button on one row, the button at the end', async (_, Surface) => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Surface />
      </div>,
    );
    const header = screen.getByTestId('header').getBoundingClientRect();
    const title = screen.getByRole('heading', { name: 'Filters' }).getBoundingClientRect();
    const close = screen.getByRole('button', { name: 'Close' }).getBoundingClientRect();
    expect(close.top).toBeLessThan(title.bottom);
    expect(title.top).toBeLessThan(close.bottom);
    expect(close.left).toBeGreaterThanOrEqual(title.right);
    expect(Math.round(close.right)).toBe(Math.round(header.right));
  });

  const parts = [
    ['Dialog', Dialog],
    ['Drawer', Drawer],
    ['BottomSheet', BottomSheet],
  ] as const;

  function renderHeader(
    { Root, Header }: (typeof parts)[number][1],
    children: ReactNode,
    dir?: 'rtl',
  ) {
    render(
      <div data-appearance="light" data-density="comfortable" dir={dir}>
        <Root open onOpenChange={() => undefined} aria-label="Panel">
          <Header data-testid="header">{children}</Header>
        </Root>
      </div>,
    );
    return screen.getByTestId('header').getBoundingClientRect();
  }

  const textLeft = (el: Element) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().left;
  };

  it.each(parts)('keeps a lone %s title at the start edge', (_, part) => {
    const header = renderHeader(part, <part.Title>Sort</part.Title>);
    expect(Math.round(textLeft(screen.getByRole('heading', { name: 'Sort' })))).toBe(Math.round(header.left));
  });

  it.each(parts)('keeps a wrapped %s title at the start and its close button at the end', (_, part) => {
    const header = renderHeader(
      part,
      <>
        <div>
          <part.Title>Sort</part.Title>
          <part.Description>By date</part.Description>
        </div>
        <part.Close>Close</part.Close>
      </>,
    );
    expect(Math.round(textLeft(screen.getByRole('heading', { name: 'Sort' })))).toBe(Math.round(header.left));
    expect(Math.round(screen.getByRole('button', { name: 'Close' }).getBoundingClientRect().right)).toBe(Math.round(header.right));
  });

  it.each(parts)('keeps a leading %s action at the start', (_, part) => {
    const header = renderHeader(
      part,
      <>
        <button type="button">Back</button>
        <part.Close>Close</part.Close>
      </>,
    );
    expect(Math.round(screen.getByRole('button', { name: 'Back' }).getBoundingClientRect().left)).toBe(Math.round(header.left));
    expect(Math.round(screen.getByRole('button', { name: 'Close' }).getBoundingClientRect().right)).toBe(Math.round(header.right));
  });

  it.each(parts)('swaps the %s title and close button in right-to-left text', (_, part) => {
    const header = renderHeader(
      part,
      <>
        <part.Title>Sort</part.Title>
        <part.Close>Close</part.Close>
      </>,
      'rtl',
    );
    const title = screen.getByRole('heading', { name: 'Sort' }).getBoundingClientRect();
    expect(Math.round(title.right)).toBe(Math.round(header.right));
    expect(Math.round(screen.getByRole('button', { name: 'Close' }).getBoundingClientRect().left)).toBe(Math.round(header.left));
  });

  it.each(parts)('puts a lone %s close button at the end', (_, part) => {
    const header = renderHeader(part, <part.Close>Close</part.Close>);
    expect(Math.round(screen.getByRole('button', { name: 'Close' }).getBoundingClientRect().right)).toBe(Math.round(header.right));
  });
});

describe('page scroll behind a modal', () => {
  const overflow = () => getComputedStyle(document.documentElement).overflow;

  const roots = [
    ['Dialog', Dialog.Root],
    ['Drawer', Drawer.Root],
    ['BottomSheet', BottomSheet.Root],
  ] as const;

  it.each(roots)('stops while a %s is open, through its exit, and comes back once it closes', async (_, Root) => {
    function Harness({ open }: { open: boolean }) {
      return (
        <Root open={open} onOpenChange={() => undefined} aria-label="Panel">
          <p>Body</p>
        </Root>
      );
    }
    expect(overflow()).not.toBe('hidden');
    const { rerender } = render(<Harness open />);
    expect(overflow()).toBe('hidden');
    expect(getComputedStyle(document.documentElement).scrollbarGutter).toBe('stable');
    const dialog = document.querySelector('dialog')!;
    rerender(<Harness open={false} />);
    // The exit motion runs with the dialog still open and the page inert.
    expect(dialog.open).toBe(true);
    expect(overflow()).toBe('hidden');
    await waitFor(() => expect(dialog.open).toBe(false), { timeout: 2000 });
    expect(overflow()).not.toBe('hidden');
  });

  it("lets the page's own root overflow and gutter win", () => {
    const style = document.createElement('style');
    style.textContent = 'html { overflow-y: scroll; scrollbar-gutter: stable both-edges }';
    document.head.append(style);
    try {
      render(
        <Dialog.Root open onOpenChange={() => undefined} aria-label="Rename">
          <p>Body</p>
        </Dialog.Root>,
      );
      expect(getComputedStyle(document.documentElement).overflowY).toBe('scroll');
      expect(getComputedStyle(document.documentElement).scrollbarGutter).toBe('stable both-edges');
    } finally {
      style.remove();
    }
  });

  it('keeps stopping while any modal is still open', () => {
    const first = document.createElement('dialog');
    const second = document.createElement('dialog');
    document.body.append(first, second);
    try {
      first.showModal();
      second.showModal();
      second.close();
      expect(overflow()).toBe('hidden');
      first.close();
      expect(overflow()).not.toBe('hidden');
    } finally {
      first.remove();
      second.remove();
    }
  });

  it('stops for a modal dialog of your own, but not for a non-modal one', () => {
    const dialog = document.createElement('dialog');
    document.body.append(dialog);
    try {
      dialog.show();
      expect(overflow()).not.toBe('hidden');
      dialog.close();
      dialog.showModal();
      expect(overflow()).toBe('hidden');
      dialog.close();
      expect(overflow()).not.toBe('hidden');
    } finally {
      dialog.remove();
    }
  });
});
