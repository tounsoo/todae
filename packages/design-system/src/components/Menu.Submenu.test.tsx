import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu, type MenuRootProps, type MenuSubmenuProps } from '../index.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Actions({
  onCopy = () => undefined,
  submenu,
  inner,
  shareDisabled,
  ...root
}: MenuRootProps & {
  onCopy?: () => void;
  submenu?: MenuSubmenuProps;
  inner?: MenuSubmenuProps;
  shareDisabled?: boolean;
}) {
  return (
    <>
      <Menu.Root {...root}>
        <Menu.Trigger variant="secondary">Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Submenu {...submenu}>
            <Menu.SubmenuTrigger disabled={shareDisabled}>Share</Menu.SubmenuTrigger>
            <Menu.SubmenuContent>
              <Menu.Item onSelect={onCopy}>Copy link</Menu.Item>
              <Menu.Item>Email</Menu.Item>
              <Menu.Submenu {...inner}>
                <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                <Menu.SubmenuContent>
                  <Menu.Item>Print</Menu.Item>
                </Menu.SubmenuContent>
              </Menu.Submenu>
            </Menu.SubmenuContent>
          </Menu.Submenu>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Content>
      </Menu.Root>
      <button type="button">After</button>
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Actions' });
const item = (name: string) => screen.getByText(name).closest<HTMLElement>('[role^="menuitem"]')!;
const menuOf = (triggerName: string) => document.getElementById(item(triggerName).getAttribute('aria-controls')!)!;
const rootMenu = () => document.getElementById(trigger().getAttribute('aria-controls')!)!;
const isOpen = (el: HTMLElement) => el.hasAttribute('data-popover-open');
const key = (k: string, target: Element = document.activeElement!) => fireEvent.keyDown(target, { key: k });
const raf = () => act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));

/** Opens the menu from its trigger and moves focus to Share. */
async function onShare() {
  act(() => trigger().focus());
  key('ArrowDown');
  await raf();
  key('ArrowDown');
  expect(document.activeElement).toBe(item('Share'));
}

describe('Menu submenus', () => {
  it('wires the trigger and the submenu', async () => {
    render(<Actions />);
    await onShare();
    const share = item('Share');
    expect(share.getAttribute('role')).toBe('menuitem');
    expect(share.getAttribute('aria-haspopup')).toBe('menu');
    expect(share.getAttribute('aria-expanded')).toBe('false');
    const sub = menuOf('Share');
    expect(sub.getAttribute('role')).toBe('menu');
    expect(sub.getAttribute('popover')).toBe('manual');
    expect(sub.getAttribute('aria-labelledby')).toBe(share.id);
    expect(isOpen(sub)).toBe(false);
    // A closed submenu mounts no items until it first opens.
    expect(screen.queryByText('Copy link')).toBeNull();
    // The chevron is drawn, not read.
    expect(share.querySelector('[data-todae-glyph]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('ArrowRight opens it on its first item, and ArrowLeft goes back', async () => {
    const onOpenChange = vi.fn();
    render(<Actions submenu={{ onOpenChange }} />);
    await onShare();
    key('ArrowRight');
    await raf();
    expect(isOpen(menuOf('Share'))).toBe(true);
    expect(item('Share').getAttribute('aria-expanded')).toBe('true');
    expect(onOpenChange).toHaveBeenLastCalledWith(true, 'trigger');
    expect(document.activeElement).toBe(item('Copy link'));
    key('ArrowLeft');
    await raf();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'arrow');
    expect(item('Share').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(item('Share'));
    expect(isOpen(rootMenu())).toBe(true);
  });

  it('Enter and Space open it too', async () => {
    render(<Actions />);
    await onShare();
    key('Enter');
    await raf();
    expect(document.activeElement).toBe(item('Copy link'));
    key('ArrowLeft');
    await raf();
    key(' ');
    await raf();
    expect(document.activeElement).toBe(item('Copy link'));
  });

  it('arrow keys and typeahead move within the submenu only', async () => {
    render(<Actions />);
    await onShare();
    key('ArrowRight');
    await raf();
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Email'));
    key('ArrowDown');
    expect(document.activeElement).toBe(item('More'));
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Copy link'));
    key('e');
    expect(document.activeElement).toBe(item('Email'));
    expect(isOpen(menuOf('Share'))).toBe(true);
  });

  it('Escape closes only the submenu', async () => {
    const onOpenChange = vi.fn();
    const onRootChange = vi.fn();
    render(<Actions onOpenChange={onRootChange} submenu={{ onOpenChange }} />);
    await onShare();
    key('ArrowRight');
    await raf();
    key('Escape');
    await raf();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'escape');
    expect(onRootChange).not.toHaveBeenCalledWith(false, expect.anything());
    expect(document.activeElement).toBe(item('Share'));
    expect(isOpen(rootMenu())).toBe(true);
    key('Escape');
    await raf();
    expect(onRootChange).toHaveBeenLastCalledWith(false, 'escape');
  });

  it('choosing an item in it closes the whole menu', async () => {
    const onCopy = vi.fn();
    const onRootChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<Actions onCopy={onCopy} onOpenChange={onRootChange} submenu={{ onOpenChange }} />);
    await onShare();
    key('ArrowRight');
    await raf();
    key('Enter');
    await raf();
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onRootChange).toHaveBeenLastCalledWith(false, 'select');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'parent');
    await act(async () => new Promise((resolve) => setTimeout(resolve)));
    expect(document.activeElement).toBe(trigger());
  });

  it('Tab in it closes the whole menu', async () => {
    const onRootChange = vi.fn();
    render(<Actions onOpenChange={onRootChange} />);
    await onShare();
    key('ArrowRight');
    await raf();
    key('Tab');
    expect(onRootChange).toHaveBeenLastCalledWith(false, 'tab');
  });

  it('closes when focus moves to another item of its menu', async () => {
    const onOpenChange = vi.fn();
    render(<Actions submenu={{ onOpenChange }} />);
    await onShare();
    fireEvent.click(item('Share'), { detail: 1 });
    await raf();
    expect(isOpen(menuOf('Share'))).toBe(true);
    // A pointer's click leaves focus on the trigger.
    expect(document.activeElement).toBe(item('Share'));
    key('ArrowDown');
    await raf();
    expect(document.activeElement).toBe(item('Delete'));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'parent');
  });

  it('a click with no pointer goes in, as a screen reader asks', async () => {
    render(<Actions />);
    await onShare();
    fireEvent.click(item('Share'), { detail: 0 });
    await raf();
    expect(document.activeElement).toBe(item('Copy link'));
  });

  it('opens when the pointer rests on its trigger', async () => {
    const onOpenChange = vi.fn();
    render(<Actions submenu={{ onOpenChange }} />);
    await onShare();
    vi.useFakeTimers();
    fireEvent.pointerMove(item('Share'), { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(50));
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60));
    expect(onOpenChange).toHaveBeenLastCalledWith(true, 'pointer');
    // Focus stays on the trigger.
    expect(document.activeElement).toBe(item('Share'));
  });

  it('does not open when the pointer moves on before the delay', async () => {
    const onOpenChange = vi.fn();
    render(<Actions submenu={{ onOpenChange }} />);
    await onShare();
    vi.useFakeTimers();
    fireEvent.pointerMove(item('Share'), { pointerType: 'mouse' });
    fireEvent.pointerLeave(item('Share'), { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(500));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('does not open once focus has moved on before the delay', async () => {
    const onOpenChange = vi.fn();
    render(<Actions submenu={{ onOpenChange }} />);
    await onShare();
    vi.useFakeTimers();
    fireEvent.pointerMove(item('Share'), { pointerType: 'mouse' });
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Delete'));
    act(() => vi.advanceTimersByTime(500));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(item('Share').getAttribute('aria-expanded')).toBe('false');
  });

  it('does not open once the menu has closed before the delay', async () => {
    const onOpenChange = vi.fn();
    render(<Actions submenu={{ onOpenChange }} />);
    await onShare();
    vi.useFakeTimers();
    fireEvent.pointerMove(item('Share'), { pointerType: 'mouse' });
    key('Escape');
    act(() => vi.advanceTimersByTime(500));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('a disabled trigger opens nothing', async () => {
    const onOpenChange = vi.fn();
    render(<Actions shareDisabled submenu={{ onOpenChange }} />);
    await onShare();
    key('ArrowRight');
    key('Enter');
    fireEvent.click(item('Share'), { detail: 1 });
    await raf();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('keeps focus still while the pointer crosses items toward the submenu', async () => {
    render(<Actions />);
    await onShare();
    fireEvent.click(item('Share'), { detail: 1 });
    await raf();
    const sub = menuOf('Share');
    const box = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(item('Share'), 'getBoundingClientRect').mockReturnValue(box(0, 40, 160, 32));
    vi.spyOn(sub, 'getBoundingClientRect').mockReturnValue(box(168, 30, 160, 120));
    // Leaves Share heading down and right, over Delete, toward the submenu.
    fireEvent.pointerLeave(item('Share'), { pointerType: 'mouse', clientX: 150, clientY: 70 });
    fireEvent.pointerMove(item('Delete'), { pointerType: 'mouse', clientX: 158, clientY: 75 });
    expect(document.activeElement).toBe(item('Share'));
    expect(isOpen(sub)).toBe(true);
    // Away from it, the item takes focus and the submenu closes.
    fireEvent.pointerMove(item('Delete'), { pointerType: 'mouse', clientX: 40, clientY: 90 });
    await raf();
    expect(document.activeElement).toBe(item('Delete'));
    expect(item('Share').getAttribute('aria-expanded')).toBe('false');
  });

  it('closes with the menu, so it is closed on the next open', async () => {
    const onOpenChange = vi.fn();
    render(<Actions submenu={{ onOpenChange }} />);
    await onShare();
    key('ArrowRight');
    await raf();
    act(() => screen.getByRole('button', { name: 'After' }).focus());
    await raf();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'parent');
    expect(item('Share').getAttribute('aria-expanded')).toBe('false');
  });

  it('nests: ArrowLeft in a submenu inside one closes only the inner one', async () => {
    const onOuter = vi.fn();
    const onInner = vi.fn();
    render(<Actions submenu={{ onOpenChange: onOuter }} inner={{ onOpenChange: onInner }} />);
    await onShare();
    key('ArrowRight');
    await raf();
    key('End');
    expect(document.activeElement).toBe(item('More'));
    key('ArrowRight');
    await raf();
    expect(document.activeElement).toBe(item('Print'));
    key('ArrowLeft');
    await raf();
    expect(onInner).toHaveBeenLastCalledWith(false, 'arrow');
    expect(onOuter).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(item('More'));
    expect(isOpen(menuOf('Share'))).toBe(true);
  });

  it('a controlled submenu that refuses to close stays open', async () => {
    render(<Actions submenu={{ open: true, onOpenChange: () => undefined }} />);
    await onShare();
    await raf();
    expect(isOpen(menuOf('Share'))).toBe(true);
  });

  it('a key open its owner refused does not move focus on a later pointer open', async () => {
    function OnlyPointer() {
      const [open, setOpen] = useState(false);
      return (
        <Actions
          submenu={{ open, onOpenChange: (next, reason) => setOpen(next && reason === 'pointer' ? true : false) }}
        />
      );
    }
    render(<OnlyPointer />);
    await onShare();
    key('ArrowRight');
    await raf();
    expect(isOpen(menuOf('Share'))).toBe(false);
    vi.useFakeTimers();
    fireEvent.pointerMove(item('Share'), { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(200));
    vi.useRealTimers();
    await raf();
    expect(isOpen(menuOf('Share'))).toBe(true);
    expect(document.activeElement).toBe(item('Share'));
  });

  it('a default open in a menu that starts closed reports no close', async () => {
    const onOpenChange = vi.fn();
    render(<Actions submenu={{ defaultOpen: true, onOpenChange }} />);
    await raf();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('throws outside Menu.Submenu', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <Menu.Root>
          <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
        </Menu.Root>,
      ),
    ).toThrow('Menu.SubmenuTrigger must render inside Menu.Submenu');
  });
});
