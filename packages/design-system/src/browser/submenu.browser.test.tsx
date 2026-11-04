import { render, screen, waitFor } from '@testing-library/react';
import { server, userEvent } from '@vitest/browser/context';
import type { CSSProperties, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Menu, type MenuSubmenuOpenChangeReason } from '../components/Menu.js';

function Themed({ children, dir }: { children: ReactNode; dir?: 'rtl' }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir}>
      {children}
    </div>
  );
}

function Actions({
  onOpenChange,
  style,
}: {
  onOpenChange?: (open: boolean, reason: MenuSubmenuOpenChangeReason) => void;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', ...style }}>
      <Menu.Root>
        <Menu.Trigger variant="secondary">Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Submenu onOpenChange={onOpenChange}>
            <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
            <Menu.SubmenuContent>
              <Menu.Item>Copy link</Menu.Item>
              <Menu.Item>Email</Menu.Item>
              <Menu.Item>Message</Menu.Item>
            </Menu.SubmenuContent>
          </Menu.Submenu>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Content>
      </Menu.Root>
    </div>
  );
}

const item = (name: string) => screen.getByRole('menuitem', { name, hidden: true });
const rootMenu = () => document.getElementById(screen.getByRole('button', { name: 'Actions' }).getAttribute('aria-controls')!)!;
// Each menu by its trigger's aria-controls: a closed menu is hidden, so it
// has no accessible name to find it by.
const submenu = () => document.getElementById(item('Share').getAttribute('aria-controls')!)!;
/** Waits out the open scale on both menus, so a box measured is where the menu sits. */
const settled = () => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
const shown = (el: HTMLElement) => el.matches(':popover-open') && el.hasAttribute('data-entered');

/** Opens the menu from its trigger with a click, then moves focus to Share. */
async function openOnShare() {
  await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
  await waitFor(() => expect(shown(rootMenu())).toBe(true));
  await userEvent.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(item('Share'));
}

describe('Menu submenus in a browser', () => {
  it('opens past the trigger with its first item level with it', async () => {
    render(
      <Themed>
        <Actions />
      </Themed>,
    );
    await openOnShare();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(shown(submenu())).toBe(true));
    expect(document.activeElement).toBe(item('Copy link'));
    await settled();
    const outer = rootMenu().getBoundingClientRect();
    const sub = submenu().getBoundingClientRect();
    const share = item('Share').getBoundingClientRect();
    const first = item('Copy link').getBoundingClientRect();
    expect(Math.abs(sub.left - outer.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(first.top - share.top)).toBeLessThanOrEqual(1);
  });

  it('flips to the start side where the end has no room', async () => {
    render(
      <Themed>
        <Actions style={{ justifyContent: 'flex-end' }} />
      </Themed>,
    );
    await openOnShare();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(shown(submenu())).toBe(true));
    await settled();
    const outer = rootMenu().getBoundingClientRect();
    const sub = submenu().getBoundingClientRect();
    const at = `menu ${outer.left}-${outer.right}, submenu ${sub.left}-${sub.right}`;
    expect(Math.abs(sub.right - outer.left), at).toBeLessThanOrEqual(1);
    expect(sub.left).toBeGreaterThanOrEqual(0);
  });

  it('opens toward the left in a right-to-left page, with the arrows swapped', async () => {
    render(
      <Themed dir="rtl">
        <Actions style={{ justifyContent: 'flex-start' }} />
      </Themed>,
    );
    await openOnShare();
    await userEvent.keyboard('{ArrowRight}');
    expect(submenu().matches(':popover-open')).toBe(false);
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(shown(submenu())).toBe(true));
    expect(document.activeElement).toBe(item('Copy link'));
    await settled();
    const outer = rootMenu().getBoundingClientRect();
    const sub = submenu().getBoundingClientRect();
    const at = `menu ${outer.left}-${outer.right}, submenu ${sub.left}-${sub.right}`;
    // Firefox mirrors a popover's position-area alignment when its parent box's direction differs
    // from the root's, so it lands at the viewport's left edge (#360). Firefox bug:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=2019601. Drop the skip once Firefox ships a fix.
    if (server.browser !== 'firefox') expect(Math.abs(sub.right - outer.left), at).toBeLessThanOrEqual(1);
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(submenu().matches(':popover-open')).toBe(false));
    expect(document.activeElement).toBe(item('Share'));
  });

  it('opens when the pointer rests on the trigger, leaving focus there', async () => {
    const onOpenChange = vi.fn();
    render(
      <Themed>
        <Actions onOpenChange={onOpenChange} />
      </Themed>,
    );
    await openOnShare();
    await userEvent.hover(item('Share'));
    await waitFor(() => expect(shown(submenu())).toBe(true));
    expect(onOpenChange).toHaveBeenCalledWith(true, 'pointer');
    expect(document.activeElement).toBe(item('Share'));
  });

  it('stays open while the pointer crosses another item toward it', async () => {
    render(
      <Themed>
        <Actions />
      </Themed>,
    );
    await openOnShare();
    const share = item('Share').getBoundingClientRect();
    await userEvent.hover(item('Share'), { position: { x: share.width - 12, y: share.height / 2 } });
    await waitFor(() => expect(shown(submenu())).toBe(true));
    // Down and toward the submenu, over Delete.
    const del = item('Delete').getBoundingClientRect();
    await userEvent.hover(item('Delete'), { position: { x: del.width - 6, y: 4 } });
    expect(document.activeElement).toBe(item('Share'));
    expect(submenu().matches(':popover-open')).toBe(true);
    await userEvent.hover(item('Email'));
    expect(document.activeElement).toBe(item('Email'));
    // Back away from it, to another item: that item takes focus and the submenu closes.
    await userEvent.hover(item('Rename'), { position: { x: 8, y: 8 } });
    expect(document.activeElement).toBe(item('Rename'));
    await waitFor(() => expect(submenu().matches(':popover-open')).toBe(false));
  });

  it('Escape closes only the submenu, and a choice in it closes the menu', async () => {
    render(
      <Themed>
        <Actions />
      </Themed>,
    );
    await openOnShare();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(shown(submenu())).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(submenu().matches(':popover-open')).toBe(false));
    expect(rootMenu().matches(':popover-open')).toBe(true);
    expect(document.activeElement).toBe(item('Share'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(shown(submenu())).toBe(true));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(rootMenu().matches(':popover-open')).toBe(false));
    expect(submenu().matches(':popover-open')).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Actions' }));
  });
});
