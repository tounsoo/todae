import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { startTransition, useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from '../components/Dialog.js';
import { Menu, type MenuOpenChangeReason } from '../components/Menu.js';

function Themed({ children }: { children: ReactNode }) {
  return (
    <div data-appearance="light" data-density="comfortable">
      {children}
    </div>
  );
}

function FileMenu({
  onOpenChange,
  withTrigger = false,
  children,
}: {
  onOpenChange?: (open: boolean, reason: MenuOpenChangeReason) => void;
  withTrigger?: boolean;
  children?: ReactNode;
}) {
  return (
    <Menu.Root onOpenChange={onOpenChange}>
      <Menu.ContextTrigger data-testid="region" tabIndex={0} style={{ blockSize: 120, inlineSize: 400 }}>
        report.pdf
        {children}
        {withTrigger && <Menu.Trigger aria-label="More">…</Menu.Trigger>}
      </Menu.ContextTrigger>
      <Menu.Content aria-label="File">
        <Menu.Item>Open</Menu.Item>
        <Menu.Item>Delete</Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}

const menu = () => screen.getByRole('menu', { hidden: true });

describe('Menu.ContextTrigger in a browser', () => {
  it('opens at the pointer on a right click and focuses the first item', async () => {
    const onOpenChange = vi.fn();
    render(
      <Themed>
        <FileMenu onOpenChange={onOpenChange} />
      </Themed>,
    );
    const region = screen.getByTestId('region');
    await userEvent.click(region, { button: 'right', position: { x: 150, y: 40 } });
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    expect(onOpenChange).toHaveBeenCalledWith(true, 'context');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Open' }));
    const r = region.getBoundingClientRect();
    const m = menu().getBoundingClientRect();
    expect(Math.abs(m.left - (r.left + 150))).toBeLessThanOrEqual(1);
    expect(m.top).toBeGreaterThanOrEqual(r.top + 40);
    expect(m.top).toBeLessThan(r.top + 40 + 16);
    expect(region.hasAttribute('data-open')).toBe(true);
  });

  it('keeps the point under a transformed ancestor', async () => {
    render(
      <Themed>
        <div style={{ transform: 'translate(37px, 23px)' }}>
          <FileMenu />
        </div>
      </Themed>,
    );
    const region = screen.getByTestId('region');
    await userEvent.click(region, { button: 'right', position: { x: 100, y: 60 } });
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    const r = region.getBoundingClientRect();
    expect(Math.abs(menu().getBoundingClientRect().left - (r.left + 100))).toBeLessThanOrEqual(1);
  });

  it('opens at the pointer inside a modal dialog', async () => {
    render(
      <Themed>
        <Dialog.Root open aria-label="Files">
          <FileMenu />
        </Dialog.Root>
      </Themed>,
    );
    const region = screen.getByTestId('region');
    await userEvent.click(region, { button: 'right', position: { x: 120, y: 30 } });
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    const r = region.getBoundingClientRect();
    expect(Math.abs(menu().getBoundingClientRect().left - (r.left + 120))).toBeLessThanOrEqual(1);
  });

  it('opens below the focused element on Shift+F10 and gives focus back on Escape', async () => {
    render(
      <Themed>
        <FileMenu />
      </Themed>,
    );
    const region = screen.getByTestId('region');
    region.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Open' }));
    const r = region.getBoundingClientRect();
    const m = menu().getBoundingClientRect();
    expect(m.top).toBeGreaterThanOrEqual(r.bottom);
    expect(m.left).toBeCloseTo(r.left, 0);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(false));
    expect(document.activeElement).toBe(region);
  });

  it('opens below the nearest box when the focused element has none', async () => {
    render(
      <Themed>
        <div data-testid="box" style={{ marginBlockStart: 200, marginInlineStart: 120, inlineSize: 300 }}>
          <Menu.Root>
            <Menu.ContextTrigger data-testid="region" style={{ display: 'contents' }}>
              report.pdf
            </Menu.ContextTrigger>
            <Menu.Content aria-label="File">
              <Menu.Item>Open</Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </div>
      </Themed>,
    );
    // As a screen reader asks for the menu of an element that has no box.
    screen
      .getByTestId('region')
      .dispatchEvent(new PointerEvent('contextmenu', { bubbles: true, cancelable: true, button: -1, pointerType: '' }));
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    const r = screen.getByTestId('box').getBoundingClientRect();
    const m = menu().getBoundingClientRect();
    expect(m.top).toBeGreaterThanOrEqual(r.bottom);
    expect(Math.abs(m.left - r.left)).toBeLessThanOrEqual(1);
  });

  it('opens on the ContextMenu key', async () => {
    render(
      <Themed>
        <FileMenu />
      </Themed>,
    );
    screen.getByTestId('region').focus();
    await userEvent.keyboard('{ContextMenu}');
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
  });

  it('flips to stay in the viewport near the bottom end corner', async () => {
    render(
      <Themed>
        <FileMenu />
      </Themed>,
    );
    const region = screen.getByTestId('region');
    region.style.position = 'fixed';
    region.style.insetInlineEnd = '0px';
    region.style.insetBlockEnd = '0px';
    await userEvent.click(region, { button: 'right', position: { x: 395, y: 115 } });
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    const m = menu().getBoundingClientRect();
    expect(m.right).toBeLessThanOrEqual(window.innerWidth);
    expect(m.bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  it('leaves the browser menu to a text field inside the region', async () => {
    const onOpenChange = vi.fn();
    render(
      <Themed>
        <FileMenu onOpenChange={onOpenChange}>
          <input aria-label="Rename" />
        </FileMenu>
      </Themed>,
    );
    const input = screen.getByRole('textbox', { name: 'Rename' });
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    input.dispatchEvent(event);
    input.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    expect(event.defaultPrevented).toBe(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('opens under Menu.Trigger after a context open', async () => {
    render(
      <Themed>
        <FileMenu withTrigger />
      </Themed>,
    );
    const region = screen.getByTestId('region');
    await userEvent.click(region, { button: 'right', position: { x: 300, y: 10 } });
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    await userEvent.keyboard('{Escape}');
    const trigger = screen.getByRole('button', { name: 'More' });
    await userEvent.click(trigger);
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    const t = trigger.getBoundingClientRect();
    const m = menu().getBoundingClientRect();
    expect(m.top).toBeGreaterThanOrEqual(t.bottom);
    expect(m.left).toBeCloseTo(t.left, 0);
    expect(region.hasAttribute('data-open')).toBe(false);
  });

  it('lets the innermost region take the request', async () => {
    const outer = vi.fn();
    render(
      <Themed>
        <Menu.Root onOpenChange={outer}>
          <Menu.ContextTrigger>
            <FileMenu />
          </Menu.ContextTrigger>
          <Menu.Content aria-label="Folder">
            <Menu.Item>New file</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Themed>,
    );
    await userEvent.click(screen.getByTestId('region'), { button: 'right', position: { x: 20, y: 20 } });
    await waitFor(() => expect(screen.getByRole('menu', { name: 'File' }).matches(':popover-open')).toBe(true));
    expect(outer).not.toHaveBeenCalled();
  });

  it('opens a Mac Ctrl+click at the pointer', async () => {
    render(
      <Themed>
        <FileMenu />
      </Themed>,
    );
    const region = screen.getByTestId('region');
    const r = region.getBoundingClientRect();
    region.dispatchEvent(
      new PointerEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ctrlKey: true,
        pointerType: 'mouse',
        clientX: r.left + 200,
        clientY: r.top + 50,
      }),
    );
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    expect(Math.abs(menu().getBoundingClientRect().left - (r.left + 200))).toBeLessThanOrEqual(1);
  });

  it('gives focus to Menu.Trigger after a right click on a region that takes no focus', async () => {
    render(
      <Themed>
        <Menu.Root>
          <Menu.ContextTrigger data-testid="plain">
            report.pdf
            <Menu.Trigger aria-label="More">…</Menu.Trigger>
          </Menu.ContextTrigger>
          <Menu.Content>
            <Menu.Item>Open</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Themed>,
    );
    await userEvent.click(screen.getByTestId('plain'), { button: 'right', position: { x: 5, y: 5 } });
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More' })));
  });

  it('moves Tab on from the element the keyboard opened the menu from', async () => {
    render(
      <Themed>
        <Menu.Root>
          <Menu.ContextTrigger>
            <button type="button">Cell</button>
            <Menu.Trigger aria-label="More">…</Menu.Trigger>
          </Menu.ContextTrigger>
          <Menu.Content>
            <Menu.Item>Open</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Themed>,
    );
    const cell = screen.getByRole('button', { name: 'Cell' });
    cell.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(menu().matches(':popover-open')).toBe(false);
    expect(document.activeElement).toBe(cell);
  });

  it('gives focus to Menu.Trigger when the opener is gone', async () => {
    function Rows() {
      const [shown, setShown] = useState(true);
      return (
        <Menu.Root>
          <Menu.ContextTrigger>
            {shown && <button type="button">Cell</button>}
            <Menu.Trigger aria-label="More">…</Menu.Trigger>
          </Menu.ContextTrigger>
          <Menu.Content>
            <Menu.Item onSelect={() => setShown(false)}>Delete</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      );
    }
    render(
      <Themed>
        <Rows />
      </Themed>,
    );
    screen.getByRole('button', { name: 'Cell' }).focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More' })));
  });

  it('keeps a keyboard menu in place when its element goes away or sits under a transform', async () => {
    function Rows() {
      const [shown, setShown] = useState(true);
      return (
        <div style={{ transform: 'translate(60px, 40px)' }}>
          <Menu.Root>
            <Menu.ContextTrigger>
              {shown && <button type="button">Cell</button>}
            </Menu.ContextTrigger>
            <Menu.Content aria-label="File">
              <Menu.Item closeOnSelect={false} onSelect={() => setShown(false)}>
                Remove cell
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </div>
      );
    }
    render(
      <Themed>
        <Rows />
      </Themed>,
    );
    const cell = screen.getByRole('button', { name: 'Cell' });
    const c = cell.getBoundingClientRect();
    cell.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    const before = menu().getBoundingClientRect();
    expect(Math.abs(before.left - c.left)).toBeLessThanOrEqual(1);
    expect(before.top).toBeGreaterThanOrEqual(c.bottom);
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('button', { name: 'Cell' })).toBeNull();
    const after = menu().getBoundingClientRect();
    expect(after.left).toBe(before.left);
    expect(after.top).toBe(before.top);
  });

  it('keeps context keys inside an open menu from opening the region around it', async () => {
    const outer = vi.fn();
    render(
      <Themed>
        <Menu.Root onOpenChange={outer}>
          <Menu.ContextTrigger>
            <FileMenu />
          </Menu.ContextTrigger>
          <Menu.Content aria-label="Folder">
            <Menu.Item>New file</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Themed>,
    );
    screen.getByTestId('region').focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(screen.getByRole('menu', { name: 'File' }).matches(':popover-open')).toBe(true));
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    expect(outer).not.toHaveBeenCalled();
  });

  it('opens from an icon inside the region', async () => {
    render(
      <Themed>
        <FileMenu>
          <svg data-testid="icon" width="24" height="24" aria-hidden="true">
            <rect width="24" height="24" />
          </svg>
        </FileMenu>
      </Themed>,
    );
    await userEvent.click(screen.getByTestId('icon'), { button: 'right' });
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
  });

  it('gives focus back to a focused icon', async () => {
    render(
      <Themed>
        <FileMenu>
          <svg data-testid="icon" tabIndex={0} width="24" height="24" aria-label="Star" role="img">
            <rect width="24" height="24" />
          </svg>
        </FileMenu>
      </Themed>,
    );
    const icon = screen.getByTestId('icon');
    icon.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(icon));
  });

  it('keeps the first opener when a screen reader asks from another region while the menu has focus', async () => {
    render(
      <Themed>
        <Menu.Root>
          <Menu.ContextTrigger data-testid="a" tabIndex={0}>
            A
          </Menu.ContextTrigger>
          <Menu.ContextTrigger data-testid="b" style={{ blockSize: 60 }}>
            B
          </Menu.ContextTrigger>
          <Menu.Content aria-label="File">
            <Menu.Item>Open</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Themed>,
    );
    const a = screen.getByTestId('a');
    a.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    screen
      .getByTestId('b')
      .dispatchEvent(new PointerEvent('contextmenu', { bubbles: true, cancelable: true, button: 0, pointerType: '' }));
    await waitFor(() => expect(screen.getByTestId('b').hasAttribute('data-open')).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(a));
  });

  it('opens at the pointer for an owner that opens in a transition', async () => {
    function Late() {
      const [open, setOpen] = useState(false);
      return (
        <Menu.Root open={open} onOpenChange={(next) => startTransition(() => setOpen(next))}>
          <Menu.ContextTrigger data-testid="region" style={{ blockSize: 120, inlineSize: 400 }}>
            report.pdf
            <Menu.Trigger aria-label="More">…</Menu.Trigger>
          </Menu.ContextTrigger>
          <Menu.Content>
            <Menu.Item>Open</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      );
    }
    render(
      <Themed>
        <Late />
      </Themed>,
    );
    const region = screen.getByTestId('region');
    await userEvent.click(region, { button: 'right', position: { x: 250, y: 80 } });
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    const r = region.getBoundingClientRect();
    expect(Math.abs(menu().getBoundingClientRect().left - (r.left + 250))).toBeLessThanOrEqual(1);
    expect(region.hasAttribute('data-open')).toBe(true);
  });

  it('moves a menu the owner keeps open to a request that comes while it is open', async () => {
    function KeptOpen() {
      const [open, setOpen] = useState(false);
      return (
        <Menu.Root open={open} onOpenChange={(next) => next && setOpen(true)}>
          <Menu.ContextTrigger data-testid="region" style={{ blockSize: 120, inlineSize: 400 }}>
            report.pdf
          </Menu.ContextTrigger>
          <Menu.Trigger>More</Menu.Trigger>
          <Menu.Content>
            <Menu.Item>Open</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      );
    }
    render(
      <Themed>
        <KeptOpen />
      </Themed>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await waitFor(() => expect(menu().matches(':popover-open')).toBe(true));
    const region = screen.getByTestId('region');
    await userEvent.click(region, { button: 'right', position: { x: 300, y: 60 } });
    const r = region.getBoundingClientRect();
    await waitFor(() => {
      const m = menu().getBoundingClientRect();
      expect(m.top).toBeGreaterThanOrEqual(r.top + 60);
      expect(m.top).toBeLessThan(r.top + 76);
    });
    expect(menu().matches(':popover-open')).toBe(true);
  });

  it('keeps focus on the item when a request moves the open menu', async () => {
    render(
      <Themed>
        <FileMenu withTrigger />
      </Themed>,
    );
    screen.getByRole('button', { name: 'More' }).focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const item = screen.getByRole('menuitem', { name: 'Delete' });
    await waitFor(() => expect(document.activeElement).toBe(item));
    screen
      .getByTestId('region')
      .dispatchEvent(new PointerEvent('contextmenu', { bubbles: true, cancelable: true, button: 0, pointerType: '' }));
    await waitFor(() => expect(menu().getBoundingClientRect().top).toBeGreaterThanOrEqual(screen.getByTestId('region').getBoundingClientRect().bottom));
    expect(menu().matches(':popover-open')).toBe(true);
    expect(document.activeElement).toBe(item);
  });
});
