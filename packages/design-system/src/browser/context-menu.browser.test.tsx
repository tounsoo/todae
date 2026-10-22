import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import type { ReactNode } from 'react';
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
});
