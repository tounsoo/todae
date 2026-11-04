import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Profiler, StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu, type MenuRootProps } from '../index.js';

afterEach(cleanup);

function Actions({
  onRename = () => undefined,
  onDelete = () => undefined,
  ...root
}: MenuRootProps & { onRename?: () => void; onDelete?: () => void }) {
  const [grid, setGrid] = useState(false);
  return (
    <>
      <Menu.Root {...root}>
        <Menu.Trigger variant="secondary">Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={onRename}>Rename</Menu.Item>
          <Menu.Item disabled>Duplicate</Menu.Item>
          <Menu.Item onSelect={onDelete}>Delete</Menu.Item>
          <Menu.Separator />
          <Menu.CheckboxItem checked={grid} onCheckedChange={setGrid}>
            Show grid
          </Menu.CheckboxItem>
          <Menu.RadioGroup aria-label="Sort" defaultValue="name">
            <Menu.RadioItem value="name">Name</Menu.RadioItem>
            <Menu.RadioItem value="date">Date</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Root>
      <button type="button">After</button>
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Actions' });
const menu = () => document.querySelector<HTMLElement>('[role="menu"]')!;
const isOpen = () => menu().hasAttribute('data-popover-open');
const item = (name: string) => screen.getByText(name).closest<HTMLElement>('[role^="menuitem"]')!;
const key = (k: string, target: Element = document.activeElement!, shiftKey = false) =>
  fireEvent.keyDown(target, { key: k, shiftKey });
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve)));
const raf = () => act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));

describe('Menu', () => {
  it('wires the trigger and the menu', () => {
    render(<Actions />);
    const button = trigger();
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe(menu().id);
    expect(menu().getAttribute('aria-labelledby')).toBe(button.id);
    expect(menu().getAttribute('popover')).toBe('manual');
    expect(isOpen()).toBe(false);
    expect(item('Duplicate').getAttribute('aria-disabled')).toBe('true');
    expect(item('Show grid').getAttribute('role')).toBe('menuitemcheckbox');
    expect(item('Show grid').getAttribute('aria-checked')).toBe('false');
    expect(item('Name').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('group', { name: 'Sort', hidden: true })).toBeTruthy();
    expect(screen.getByRole('separator', { hidden: true })).toBeTruthy();
  });

  it('opens on click and focuses the first item', async () => {
    const onOpenChange = vi.fn();
    render(<Actions onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    expect(isOpen()).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(true, 'trigger');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(item('Rename'));
  });

  it('ArrowUp on the trigger opens on the last item', async () => {
    render(<Actions />);
    act(() => trigger().focus());
    key('ArrowUp');
    await raf();
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(item('Date'));
  });

  it('reopens on the first item, not the last one focused', async () => {
    render(<Actions />);
    act(() => trigger().focus());
    key('ArrowDown');
    await raf();
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Duplicate'));
    key('Escape');
    await raf();
    expect(isOpen()).toBe(false);
    key('ArrowDown', trigger());
    await raf();
    expect(document.activeElement).toBe(item('Rename'));
  });

  it('moves with arrows through disabled items too, loops, and uses typeahead', async () => {
    render(<Actions />);
    fireEvent.click(trigger());
    await raf();
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Duplicate'));
    key('Enter');
    expect(isOpen()).toBe(true);
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Delete'));
    key('ArrowUp');
    key('ArrowUp');
    key('ArrowUp');
    expect(document.activeElement).toBe(item('Date'));
    key('Home');
    fireEvent.keyDown(document.activeElement!, { key: 's', timeStamp: 1 });
    expect(document.activeElement).toBe(item('Show grid'));
  });

  it('chooses an item with Enter, closes and returns focus to the trigger', async () => {
    const onRename = vi.fn();
    const onOpenChange = vi.fn();
    render(<Actions onRename={onRename} onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    key('Enter');
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'select');
    await act(async () => undefined);
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });

  it('chooses an item with Space on keyup, not keydown', async () => {
    const onRename = vi.fn();
    render(<Actions onRename={onRename} />);
    fireEvent.click(trigger());
    await raf();
    key(' ');
    expect(onRename).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
    fireEvent.keyUp(document.activeElement!, { key: ' ' });
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
  });

  it('a space inside a typeahead search searches instead of choosing', async () => {
    const onSelect = vi.fn();
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>File</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={onSelect}>New window</Menu.Item>
          <Menu.Item onSelect={onSelect}>New file</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    await raf();
    for (const [i, k] of [...'new f'].entries()) {
      fireEvent.keyDown(document.activeElement!, { key: k, timeStamp: 1000 + i * 50 });
      fireEvent.keyUp(document.activeElement!, { key: k, timeStamp: 1000 + i * 50 });
    }
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(item('New file'));
  });

  it('a press does not focus a disabled item', async () => {
    render(<Actions />);
    fireEvent.click(trigger());
    await raf();
    const pressed = fireEvent.mouseDown(item('Duplicate'));
    expect(pressed).toBe(false);
  });

  it('chooses an item with a click and ignores disabled items', async () => {
    const onDelete = vi.fn();
    render(<Actions onDelete={onDelete} />);
    fireEvent.click(trigger());
    await raf();
    fireEvent.click(item('Duplicate'));
    expect(isOpen()).toBe(true);
    fireEvent.click(item('Delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
  });

  it('renders an item as a link that Enter follows, and a disabled one goes nowhere', async () => {
    const onSelect = vi.fn();
    // A click whose default nothing prevents is one the browser follows.
    const clicks: MouseEvent[] = [];
    const record = (event: MouseEvent) => clicks.push(event);
    const followed = () => clicks.filter((event) => !event.defaultPrevented).map((event) => (event.target as Element).getAttribute('href'));
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Help</Menu.Trigger>
        <Menu.Content>
          <Menu.Item disabled render={(props) => <a {...props} href="#old" />}>
            Old docs
          </Menu.Item>
          <Menu.Item onSelect={onSelect} render={(props) => <a {...props} href="#docs" />}>
            Docs
          </Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    await raf();
    const old = screen.getByRole('menuitem', { name: 'Old docs' });
    const docs = screen.getByRole('menuitem', { name: 'Docs' });
    expect(old.tagName).toBe('A');
    for (const link of [old, docs]) link.addEventListener('click', record);
    key('Enter', old);
    fireEvent.click(old);
    expect(followed()).toEqual([]);
    expect(onSelect).not.toHaveBeenCalled();
    key('Enter', docs);
    expect(followed()).toEqual(['#docs']);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
  });

  it("runs an item's onClick when a key chooses it, as a click would", async () => {
    const onClick = vi.fn();
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>File</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onClick={onClick}>New</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    await raf();
    key(' ');
    fireEvent.keyUp(document.activeElement!, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('runs no onClick on a disabled item, from a key or a press', async () => {
    const onClick = vi.fn();
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>File</Menu.Trigger>
        <Menu.Content>
          <Menu.Item disabled onClick={onClick}>
            Old
          </Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    await raf();
    const old = screen.getByRole('menuitem', { name: 'Old' });
    key('Enter', old);
    fireEvent.click(old);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('passes the modifier keys of Enter on to the click, so a link item can open in a new tab', async () => {
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Help</Menu.Trigger>
        <Menu.Content>
          <Menu.Item render={(props) => <a {...props} href="#docs" />}>Docs</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    await raf();
    const docs = screen.getByRole('menuitem', { name: 'Docs' });
    const clicks: MouseEvent[] = [];
    docs.addEventListener('click', (event) => clicks.push(event));
    fireEvent.keyDown(docs, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(clicks.map(({ ctrlKey, shiftKey, metaKey }) => ({ ctrlKey, shiftKey, metaKey }))).toEqual([
      { ctrlKey: true, shiftKey: true, metaKey: false },
    ]);
  });

  it('toggles checkbox and radio items without closing', async () => {
    render(<Actions />);
    fireEvent.click(trigger());
    await raf();
    fireEvent.click(item('Show grid'));
    expect(item('Show grid').getAttribute('aria-checked')).toBe('true');
    act(() => item('Date').focus());
    key(' ');
    expect(item('Date').getAttribute('aria-checked')).toBe('false');
    fireEvent.keyUp(document.activeElement!, { key: ' ' });
    expect(item('Date').getAttribute('aria-checked')).toBe('true');
    expect(item('Name').getAttribute('aria-checked')).toBe('false');
    expect(isOpen()).toBe(true);
  });

  it('a radio group takes defaultValue null for no choice yet', async () => {
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.RadioGroup aria-label="Sort" defaultValue={null}>
            <Menu.RadioItem value="name">Name</Menu.RadioItem>
            <Menu.RadioItem value="date">Date</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Root>,
    );
    await raf();
    expect(item('Name').getAttribute('aria-checked')).toBe('false');
    expect(item('Date').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(item('Date'));
    expect(item('Date').getAttribute('aria-checked')).toBe('true');
  });

  it('closes on Escape with focus back on the trigger', async () => {
    const onOpenChange = vi.fn();
    render(<Actions onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    key('Escape');
    await act(async () => undefined);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'escape');
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });

  it('closes when focus moves outside some other way, with reason outside', async () => {
    const onOpenChange = vi.fn();
    render(<Actions onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    act(() => item('Delete').focus());
    act(() => item('Rename').focus());
    expect(isOpen()).toBe(true);
    act(() => screen.getByRole('button', { name: 'After' }).focus());
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'outside');
    expect(isOpen()).toBe(false);
  });

  it('stays open when focus goes nowhere or back to the trigger', async () => {
    const onOpenChange = vi.fn();
    render(<Actions onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    onOpenChange.mockClear();
    // A focused item removed or a window losing focus: no next target, and
    // focus is not on anything outside.
    fireEvent.blur(item('Rename'), { relatedTarget: null });
    await settle();
    act(() => trigger().focus());
    await settle();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
  });

  it('closes once focus settles outside after a blur with no target, as into an iframe', async () => {
    const onOpenChange = vi.fn();
    render(<Actions onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    const after = screen.getByRole('button', { name: 'After' });
    // An iframe takes focus without telling the menu where it went.
    const active = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(after);
    try {
      fireEvent.blur(item('Rename'), { relatedTarget: null });
      expect(onOpenChange).not.toHaveBeenCalledWith(false, 'outside');
      await settle();
    } finally {
      active.mockRestore();
    }
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'outside');
    expect(isOpen()).toBe(false);
  });

  it('a blur with no target checks nothing once the menu has gone', async () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(<Actions onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    onOpenChange.mockClear();
    fireEvent.blur(item('Rename'), { relatedTarget: null });
    unmount();
    await settle();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closes on Tab with reason tab', async () => {
    const onOpenChange = vi.fn();
    render(<Actions onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    key('Tab');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'tab');
    expect(isOpen()).toBe(false);
  });

  it('a menu with no trigger lets Shift+Tab move on and reports only tab', async () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <button type="button">Before</button>
        <Menu.Root defaultOpen onOpenChange={onOpenChange}>
          <Menu.Content aria-label="Actions">
            <Menu.Item>Rename</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </>,
    );
    await raf();
    act(() => item('Rename').focus());
    expect(key('Tab', item('Rename'), true)).toBe(true);
    // The browser then moves focus on, out of the menu.
    act(() => screen.getByRole('button', { name: 'Before' }).focus());
    expect(onOpenChange.mock.calls).toEqual([[false, 'tab']]);
  });

  it('a consumer onBlur that prevents the event still closes on focus leaving', async () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <Menu.Root onOpenChange={onOpenChange}>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Content onBlur={(event) => event.preventDefault()}>
            <Menu.Item>Rename</Menu.Item>
          </Menu.Content>
        </Menu.Root>
        <button type="button">After</button>
      </>,
    );
    fireEvent.click(trigger());
    await raf();
    act(() => screen.getByRole('button', { name: 'After' }).focus());
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'outside');
  });

  it('closes on an outside press', async () => {
    const onOpenChange = vi.fn();
    render(<Actions onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'After' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'outside');
  });

  it('a controlled menu that ignores a close stays open', async () => {
    render(<Actions open onOpenChange={() => undefined} />);
    await raf();
    key('Escape');
    expect(isOpen()).toBe(true);
  });

  it('an outside press on a focusable element reports one close', async () => {
    const onOpenChange = vi.fn();
    render(<Actions open onOpenChange={onOpenChange} />);
    await raf();
    const after = screen.getByRole('button', { name: 'After' });
    // The press, then the focus move that same press makes.
    fireEvent.pointerDown(after);
    act(() => after.focus());
    expect(onOpenChange.mock.calls).toEqual([[false, 'outside']]);
  });

  it('Shift+Tab moves on as usual when the trigger cannot take focus', async () => {
    const onOpenChange = vi.fn();
    render(
      <Menu.Root open onOpenChange={onOpenChange}>
        <Menu.Trigger disabled>Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>Rename</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    await raf();
    act(() => item('Rename').focus());
    expect(key('Tab', item('Rename'), true)).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'tab');
  });

  it('a Tab that leaves focus in place does not mute a later focus leave', async () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <Menu.Root open onOpenChange={onOpenChange}>
          <Menu.Content aria-label="Actions">
            <Menu.Item>Rename</Menu.Item>
          </Menu.Content>
        </Menu.Root>
        <button type="button">After</button>
      </>,
    );
    await raf();
    act(() => item('Rename').focus());
    // The owner keeps it open and focus stays on the item.
    key('Tab');
    await settle();
    act(() => screen.getByRole('button', { name: 'After' }).focus());
    expect(onOpenChange.mock.calls).toEqual([
      [false, 'tab'],
      [false, 'outside'],
    ]);
  });

  it('focuses the first item when open on mount', async () => {
    render(<Actions defaultOpen />);
    await raf();
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(item('Rename'));
  });

  it('a controlled reopen starts on the first item, not the last one focused', async () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Shortcut
          </button>
          <Actions open={open} onOpenChange={setOpen} />
        </>
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole('button', { name: 'Shortcut' }));
    await raf();
    key('End');
    expect(document.activeElement).toBe(item('Date'));
    key('Escape');
    await raf();
    expect(isOpen()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Shortcut' }));
    await raf();
    expect(document.activeElement).toBe(item('Rename'));
  });

  it('a Space released on another item chooses nothing', async () => {
    const chosen: string[] = [];
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Content>
          <Menu.Item closeOnSelect={false} onSelect={() => chosen.push('A')}>
            Alpha
          </Menu.Item>
          <Menu.Item closeOnSelect={false} onSelect={() => chosen.push('B')}>
            Beta
          </Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    await raf();
    const alpha = item('Alpha');
    const beta = item('Beta');
    act(() => alpha.focus());
    fireEvent.keyDown(alpha, { key: ' ' });
    act(() => beta.focus());
    fireEvent.keyUp(beta, { key: ' ' });
    fireEvent.keyDown(beta, { key: ' ' });
    act(() => alpha.focus());
    fireEvent.keyUp(alpha, { key: ' ' });
    expect(chosen).toEqual([]);
  });

  it('a held Enter chooses once and does not toggle the trigger', async () => {
    const onRename = vi.fn();
    const onOpenChange = vi.fn();
    render(<Actions onRename={onRename} onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    key('Enter');
    expect(onRename).toHaveBeenCalledTimes(1);
    act(() => trigger().focus());
    onOpenChange.mockClear();
    const repeat = fireEvent.keyDown(trigger(), { key: 'Enter', repeat: true });
    expect(repeat).toBe(false);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown', repeat: true });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('a refused ArrowUp open does not make the next open start at the end', async () => {
    function Gate() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Show
          </button>
          <Actions open={open} onOpenChange={(next, reason) => reason !== 'trigger' && setOpen(next)} />
        </>
      );
    }
    render(<Gate />);
    act(() => trigger().focus());
    key('ArrowUp');
    act(() => screen.getByRole('button', { name: 'Show' }).focus());
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    await raf();
    expect(document.activeElement).toBe(item('Rename'));
  });

  it('is named by its trigger only when one is mounted', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>Rename</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    const menu = () => screen.getByRole('menu', { hidden: true });
    expect(menu().getAttribute('aria-labelledby')).toBe(trigger().id);
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
    rerender(
      <Menu.Root defaultOpen>
        <Menu.Content>
          <Menu.Item>Rename</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    expect(menu().hasAttribute('aria-labelledby')).toBe(false);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Menu.Content needs aria-label'));
    spy.mockRestore();
  });

  it('stays named while one of two triggers remains', () => {
    function Two({ both }: { both: boolean }) {
      return (
        <Menu.Root defaultOpen>
          {both && <Menu.Trigger>Overflow</Menu.Trigger>}
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Content>
            <Menu.Item>Rename</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      );
    }
    const { rerender } = render(<Two both />);
    rerender(<Two both={false} />);
    expect(screen.getByRole('menu', { hidden: true }).getAttribute('aria-labelledby')).toBe(trigger().id);
  });

  it('leaves Enter and Space in a control inside an item to that control', () => {
    const onSelect = vi.fn();
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={onSelect}>
            Rename <input aria-label="New name" />
          </Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    const input = screen.getByRole('textbox', { name: 'New name' });
    expect(fireEvent.keyDown(input, { key: ' ' })).toBe(true);
    fireEvent.keyUp(input, { key: ' ' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('a refused ArrowUp open is forgotten even when the trigger blur is prevented', async () => {
    function Gate() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Show
          </button>
          <Menu.Root open={open} onOpenChange={(next, reason) => reason !== 'trigger' && setOpen(next)}>
            <Menu.Trigger onBlur={(event) => event.preventDefault()}>Actions</Menu.Trigger>
            <Menu.Content>
              <Menu.Item>Rename</Menu.Item>
              <Menu.Item>Delete</Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </>
      );
    }
    render(<Gate />);
    act(() => trigger().focus());
    key('ArrowUp');
    act(() => screen.getByRole('button', { name: 'Show' }).focus());
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    await raf();
    expect(document.activeElement).toBe(item('Rename'));
  });

  it('an ArrowUp open an owner applies a little later still starts at the end', async () => {
    function Later() {
      const [open, setOpen] = useState(false);
      return <Actions open={open} onOpenChange={(next) => setTimeout(() => setOpen(next), 1500)} />;
    }
    render(<Later />);
    act(() => trigger().focus());
    key('ArrowUp');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1600));
    });
    await raf();
    expect(document.activeElement).toBe(item('Date'));
  });

  it('re-rendering the menu does not re-observe its items', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const { rerender } = render(<Actions defaultOpen data-tick={1} />);
    await raf();
    observe.mockClear();
    rerender(<Actions defaultOpen data-tick={2} />);
    expect(observe).not.toHaveBeenCalled();
    observe.mockRestore();
  });

  it("keeps the trigger's ref attached across renders", async () => {
    const attach = vi.fn();
    function WithRef({ tick }: { tick: number }) {
      return (
        <Menu.Root>
          <Menu.Trigger ref={attach} data-tick={tick}>
            Actions
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item>One</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      );
    }
    const { rerender } = render(<WithRef tick={1} />);
    rerender(<WithRef tick={2} />);
    fireEvent.click(trigger());
    await raf();
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('a trigger click the consumer prevents does not open', () => {
    const onOpenChange = vi.fn();
    render(
      <Menu.Root onOpenChange={onOpenChange}>
        <Menu.Trigger onClick={(event) => event.preventDefault()}>Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>One</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    fireEvent.click(trigger());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('Shift+Tab leaves the menu even when the owner keeps it open', async () => {
    render(<Actions open onOpenChange={() => undefined} />);
    await raf();
    act(() => item('Rename').focus());
    fireEvent.keyDown(item('Rename'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(trigger());
  });

  it('a forward Tab leaves the menu even when the owner keeps it open', async () => {
    render(<Actions open onOpenChange={() => undefined} />);
    await raf();
    act(() => menu().focus());
    fireEvent.keyDown(menu(), { key: 'Tab' });
    expect(document.activeElement).toBe(trigger());
  });

  it('items are never Tab stops, so Tab cannot enter a menu the owner keeps open', async () => {
    render(<Actions open onOpenChange={() => undefined} />);
    await raf();
    expect(screen.getAllByRole('menuitem').every((el) => el.tabIndex === -1)).toBe(true);
  });

  it('hovering a disabled item focuses it, so Enter chooses nothing and arrows keep their place', async () => {
    const onRename = vi.fn();
    render(<Actions onRename={onRename} />);
    fireEvent.click(trigger());
    await raf();
    fireEvent.pointerMove(item('Duplicate'), { pointerType: 'mouse' });
    expect(document.activeElement).toBe(item('Duplicate'));
    key('Enter');
    expect(onRename).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Delete'));
  });

  it('opens on the first item focus can reach', async () => {
    const original = HTMLElement.prototype.checkVisibility;
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return this.textContent !== 'Rename';
    };
    try {
      render(<Actions />);
      fireEvent.click(trigger());
      await raf();
      expect(document.activeElement).toBe(item('Duplicate'));
    } finally {
      HTMLElement.prototype.checkVisibility = original;
    }
  });

  it('Tab from the trigger of an open menu closes it', async () => {
    const onOpenChange = vi.fn();
    render(<Actions open onOpenChange={onOpenChange} />);
    await raf();
    act(() => trigger().focus());
    key('Tab');
    expect(onOpenChange).toHaveBeenCalledWith(false, 'tab');
  });

  it('Shift+Tab closes the menu and stops on the trigger', async () => {
    render(<Actions />);
    fireEvent.click(trigger());
    await raf();
    const kept = fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(kept).toBe(false);
    await raf();
    expect(document.activeElement).toBe(trigger());
  });

  it('moving focus across items does not render the menu', async () => {
    let commits = 0;
    render(
      <Profiler id="menu" onRender={() => (commits += 1)}>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Content>
            <Menu.Item>One</Menu.Item>
            <Menu.Item>Two</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Profiler>,
    );
    await raf();
    const before = commits;
    act(() => item('Two').focus());
    act(() => item('One').focus());
    expect(commits).toBe(before);
  });

  it('a menu with a read-only open does not render on Escape or an outside press', async () => {
    let commits = 0;
    render(
      <>
        <Profiler id="menu" onRender={() => (commits += 1)}>
          <Menu.Root open>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Content>
              <Menu.Item>One</Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </Profiler>
        <button type="button">After</button>
      </>,
    );
    await raf();
    const before = commits;
    fireEvent.keyDown(item('One'), { key: 'Escape' });
    await raf();
    fireEvent.pointerDown(screen.getByText('After'));
    fireEvent.click(screen.getByText('After'));
    await raf();
    expect(commits).toBe(before);
  });

  it('with a read-only open, a trigger click opens under the trigger after a refused context request', async () => {
    function Owned() {
      const [open, setOpen] = useState(false);
      return (
        <Menu.Root open={open}>
          <Menu.Trigger onClick={() => setOpen((was) => !was)}>Open</Menu.Trigger>
          <Menu.ContextTrigger data-testid="region">Row</Menu.ContextTrigger>
          <Menu.Content>
            <Menu.Item>One</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      );
    }
    render(<Owned />);
    fireEvent.contextMenu(screen.getByTestId('region'), { clientX: 40, clientY: 50, button: 2 });
    await raf();
    // A click with no pointerdown or keydown before it, as assistive tech sends.
    fireEvent.click(screen.getByText('Open'));
    await raf();
    expect(screen.getByTestId('region').hasAttribute('data-open')).toBe(false);
  });

  it('a radio group with a read-only value does not render on a click', async () => {
    let commits = 0;
    render(
      <Profiler id="menu" onRender={() => (commits += 1)}>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Content>
            <Menu.RadioGroup aria-label="Sort" value="name">
              <Menu.RadioItem value="name">Name</Menu.RadioItem>
              <Menu.RadioItem value="date">Date</Menu.RadioItem>
            </Menu.RadioGroup>
          </Menu.Content>
        </Menu.Root>
      </Profiler>,
    );
    await raf();
    const date = screen.getByText('Date').closest<HTMLElement>('[role="menuitemradio"]')!;
    const before = commits;
    act(() => date.click());
    expect(date.getAttribute('aria-checked')).toBe('false');
    expect(commits).toBe(before);
  });

  it('arrow keys on the trigger of an open menu move into it', async () => {
    render(<Actions open onOpenChange={() => undefined} />);
    await raf();
    act(() => trigger().focus());
    key('ArrowUp');
    expect(document.activeElement).toBe(item('Date'));
    act(() => trigger().focus());
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Rename'));
  });

  it('arrow keys work when focus is on the menu itself', async () => {
    render(<Actions />);
    fireEvent.click(trigger());
    await raf();
    act(() => menu().focus());
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Rename'));
    act(() => menu().focus());
    key('End');
    expect(document.activeElement).toBe(item('Date'));
    act(() => menu().focus());
    key('r');
    expect(document.activeElement).toBe(item('Rename'));
  });

  it('runs consumer pointer and click handlers on the content', async () => {
    const onClick = vi.fn();
    const onPointerDown = vi.fn();
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Content onClick={onClick} onPointerDown={onPointerDown}>
          <Menu.Item>New</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    fireEvent.pointerDown(menu());
    fireEvent.click(menu());
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('takes its own name', () => {
    render(
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Content aria-label="File">
          <Menu.Item>New</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    expect(menu().getAttribute('aria-label')).toBe('File');
    expect(menu().hasAttribute('aria-labelledby')).toBe(false);
  });

  it('throws outside Menu.Root and Menu.RadioGroup', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Menu.Item>x</Menu.Item>)).toThrow('Menu.Item must render inside Menu.Root');
    expect(() =>
      render(
        <Menu.Root>
          <Menu.RadioItem value="a">a</Menu.RadioItem>
        </Menu.Root>,
      ),
    ).toThrow('Menu.RadioItem must render inside Menu.RadioGroup');
    spy.mockRestore();
  });
});

describe('Menu.ContextTrigger', () => {
  it('logs an error when an open menu has no name', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <Menu.Root defaultOpen>
        <Menu.ContextTrigger>Row</Menu.ContextTrigger>
        <Menu.Content>
          <Menu.Item>Open</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    await Promise.resolve();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Menu.Content needs aria-label or aria-labelledby'));
    spy.mockRestore();
  });

  it('logs no error when a Menu.Trigger names a menu that mounts open', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>Open</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('drops a request the owner turns down', () => {
    render(
      <Menu.Root open={false}>
        <Menu.ContextTrigger data-testid="region">Row</Menu.ContextTrigger>
        <Menu.Content aria-label="File">
          <Menu.Item>Open</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    act(() => {
      fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 10, clientY: 10 });
    });
    expect(document.querySelector('span[popover]')).not.toBeNull();
    act(() => {
      fireEvent.keyDown(document.body, { key: 'a' });
    });
    expect(document.querySelector('span[popover]')).toBeNull();
  });

  it('drops a turned-down request when a Menu.Trigger opens the menu', () => {
    function Owner() {
      const [open, setOpen] = useState(false);
      return (
        <Menu.Root open={open} onOpenChange={(next, reason) => reason !== 'context' && setOpen(next)}>
          <Menu.ContextTrigger data-testid="region">Row</Menu.ContextTrigger>
          <Menu.Trigger>More</Menu.Trigger>
          <Menu.Content>
            <Menu.Item>Open</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      );
    }
    render(<Owner />);
    act(() => {
      fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 10, clientY: 10 });
    });
    act(() => {
      screen.getByRole('button', { name: 'More' }).click();
    });
    expect(screen.getByRole('menu', { hidden: true }).style.getPropertyValue('position-anchor')).not.toContain('-box');
    expect(document.querySelector('span[popover]')).toBeNull();
  });

  it('renders the region on the element render returns', () => {
    render(
      <table>
        <tbody>
          <Menu.Root>
            <Menu.ContextTrigger
              render={(props) => (
                <tr {...props}>
                  <td>report.pdf</td>
                </tr>
              )}
            />
          </Menu.Root>
        </tbody>
      </table>,
    );
    const row = screen.getByRole('row');
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    act(() => {
      screen.getByRole('cell').dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(row.hasAttribute('data-open')).toBe(true);
  });

  it('keeps the browser menu from opening over an open menu', () => {
    render(
      <Menu.Root defaultOpen>
        <Menu.Content aria-label="File">
          <Menu.Item>Open</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    screen.getByRole('menuitem', { hidden: true }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('A context menu closing with an exit fade', () => {
  afterEach(() => vi.restoreAllMocks());

  it('stays anchored at the box it opened at until the fade ends', () => {
    // Popover.module.css gives the menu its exit (200ms by default); jsdom reads no
    // stylesheet, so supply the computed transition the browser would.
    // The menu is drawn two frames after it shows; pass them at once.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
      const style = real(el, pseudo);
      if (el instanceof HTMLElement && el.getAttribute('role') === 'menu') {
        return Object.assign(Object.create(style), {
          transitionProperty: 'opacity, scale',
          transitionDuration: '0.16s',
          transitionDelay: '0s',
        }) as CSSStyleDeclaration;
      }
      return style;
    });
    render(
      <Menu.Root>
        <Menu.ContextTrigger data-testid="region">Row</Menu.ContextTrigger>
        <Menu.Content aria-label="File">
          <Menu.Item>Open</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    act(() => {
      fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 40, clientY: 50 });
    });
    const menu = screen.getByRole('menu', { hidden: true });
    const boxName = menu.style.getPropertyValue('position-anchor');
    expect(boxName).toContain('-box');
    expect(document.querySelector('span[popover]')).not.toBeNull();

    act(() => {
      fireEvent.keyDown(menu, { key: 'Escape' });
    });
    // It stays shown, out of reach, for its exit fade, and should still sit
    // at the box meanwhile.
    expect(menu.hasAttribute('data-todae-exiting')).toBe(true);
    expect(menu.inert).toBe(true);
    expect(menu.style.getPropertyValue('position-anchor')).toBe(boxName);
    expect(document.querySelector('span[popover]')).not.toBeNull();
    expect(menu.hasAttribute('data-todae-unanchored')).toBe(false);
    // The fade's end lets the box go.
    act(() => {
      menu.dispatchEvent(Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'opacity' }));
    });
    expect(document.querySelector('span[popover]')).toBeNull();
  });
});

describe('Menu motion', () => {
  function fakeExit() {
    // The menu is drawn two frames after it shows; pass them at once.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
      const style = real(el, pseudo);
      if (el instanceof HTMLElement && el.getAttribute('role') === 'menu') {
        return Object.assign(Object.create(style), {
          transitionProperty: 'opacity, scale',
          transitionDuration: '0.16s',
          transitionDelay: '0s',
        }) as CSSStyleDeclaration;
      }
      return style;
    });
  }

  const ui = (
    <Menu.Root>
      <Menu.Trigger>Actions</Menu.Trigger>
      <Menu.ContextTrigger data-testid="region">Row</Menu.ContextTrigger>
      <Menu.Content>
        <Menu.Item>Open</Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );

  const menu = () => screen.getByRole('menu', { hidden: true });
  const endFade = () =>
    act(() => {
      menu().dispatchEvent(Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'opacity' }));
    });

  describe('A menu opened from its trigger after a context menu', () => {
    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    it('fades out by its trigger once the context fade ended', () => {
      fakeExit();
      render(ui);
      act(() => {
        fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 40, clientY: 50 });
      });
      const boxName = menu().style.getPropertyValue('position-anchor');
      expect(boxName).toContain('-box');
      act(() => {
        fireEvent.keyDown(menu(), { key: 'Escape' });
      });
      endFade();
      expect(document.querySelector('span[popover]')).toBeNull();

      // Now open from the trigger and close it again.
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
      });
      expect(menu().hasAttribute('data-popover-open')).toBe(true);
      expect(menu().style.getPropertyValue('position-anchor')).not.toBe(boxName);
      act(() => {
        fireEvent.keyDown(menu(), { key: 'Escape' });
      });
      // During its exit fade it should stay by the trigger.
      expect(menu().style.getPropertyValue('position-anchor')).not.toBe(boxName);
      expect(document.querySelector('span[popover]')).toBeNull();
    });

    it('fades out by its trigger when opened from it inside the context fade', () => {
      fakeExit();
      render(ui);
      act(() => {
        fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 40, clientY: 50 });
      });
      const boxName = menu().style.getPropertyValue('position-anchor');
      act(() => {
        fireEvent.keyDown(menu(), { key: 'Escape' });
      });
      // Still fading; reopen from the trigger.
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
      });
      expect(menu().style.getPropertyValue('position-anchor')).not.toBe(boxName);
      act(() => {
        fireEvent.keyDown(menu(), { key: 'Escape' });
      });
      expect(menu().style.getPropertyValue('position-anchor')).not.toBe(boxName);
      expect(document.querySelector('span[popover]')).toBeNull();
    });
  });


  describe('A context-only menu', () => {
    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    it('is not marked as having lost its anchor before it ever opened', () => {
      render(
        <Menu.Root>
          <Menu.ContextTrigger data-testid="region">Row</Menu.ContextTrigger>
          <Menu.Content aria-label="File">
            <Menu.Item>Open</Menu.Item>
          </Menu.Content>
        </Menu.Root>,
      );
      expect(screen.getByRole('menu', { hidden: true }).hasAttribute('data-todae-unanchored')).toBe(false);
    });

    it('has no such mark when its layout is first read after showing', () => {
      render(
        <Menu.Root>
          <Menu.ContextTrigger data-testid="region">Row</Menu.ContextTrigger>
          <Menu.Content aria-label="File">
            <Menu.Item>Open</Menu.Item>
          </Menu.Content>
        </Menu.Root>,
      );
      const el = screen.getByRole('menu', { hidden: true });
      const seen: boolean[] = [];
      const realShow = el.showPopover.bind(el);
      let shown = false;
      el.showPopover = () => {
        shown = true;
        realShow();
      };
      const realRect = el.getBoundingClientRect.bind(el);
      vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => {
        if (shown) seen.push(el.hasAttribute('data-todae-unanchored'));
        return realRect();
      });
      act(() => {
        fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 40, clientY: 50 });
      });
      expect(el.hasAttribute('data-popover-open')).toBe(true);
      // A forced layout read with the mark present resolves the opening style with no transition.
      // (On main nothing reads the menu's box here and nothing marks it.)
      expect(seen).not.toContain(true);
    });
  });
});

describe('Menu motion while it fades', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** The computed exit a browser gives `.content`: a fade, or none once the lost-anchor mark is on. */
  function markAwareFade(match: (el: HTMLElement) => boolean) {
    // The menu is drawn two frames after it shows; pass them at once.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
      const style = real(el, pseudo);
      if (el instanceof HTMLElement && match(el)) {
        const none = el.hasAttribute('data-todae-unanchored');
        return Object.assign(Object.create(style), {
          transitionProperty: none ? 'none' : 'opacity, scale',
          transitionDuration: none ? '0s' : '0.16s',
          transitionDelay: '0s',
        }) as CSSStyleDeclaration;
      }
      return style;
    });
  }

  describe('under StrictMode', () => {
    const ui = (
      <StrictMode>
        <Menu.Root>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.ContextTrigger data-testid="region">Row</Menu.ContextTrigger>
          <Menu.Content>
            <Menu.Item>Open</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </StrictMode>
    );
    const menu = () => screen.getByRole('menu', { hidden: true });
    const endFade = () =>
      act(() => {
        menu().dispatchEvent(Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'opacity' }));
      });

    it('fades a trigger-opened menu by its trigger after a context menu', () => {
      markAwareFade((el) => el.getAttribute('role') === 'menu');
      render(ui);
      act(() => {
        fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 40, clientY: 50 });
      });
      const boxName = menu().style.getPropertyValue('position-anchor');
      expect(boxName).toContain('-box');
      act(() => {
        fireEvent.keyDown(menu(), { key: 'Escape' });
      });
      expect(menu().style.getPropertyValue('position-anchor')).toBe(boxName);
      endFade();
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
      });
      act(() => {
        fireEvent.keyDown(menu(), { key: 'Escape' });
      });
      expect(menu().style.getPropertyValue('position-anchor')).not.toBe(boxName);
      expect(document.querySelector('span[popover]')).toBeNull();
      expect(menu().hasAttribute('data-todae-unanchored')).toBe(false);
    });

    it('opens at a box asked for inside a trigger-opened fade, and fades there', () => {
      markAwareFade((el) => el.getAttribute('role') === 'menu');
      render(ui);
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
      });
      act(() => {
        fireEvent.keyDown(menu(), { key: 'Escape' });
      });
      act(() => {
        fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 40, clientY: 50 });
      });
      expect(menu().hasAttribute('data-popover-open')).toBe(true);
      const boxName = menu().style.getPropertyValue('position-anchor');
      expect(boxName).toContain('-box');
      expect(menu().hasAttribute('data-todae-unanchored')).toBe(false);
      act(() => {
        fireEvent.keyDown(menu(), { key: 'Escape' });
      });
      expect(menu().style.getPropertyValue('position-anchor')).toBe(boxName);
      expect(document.querySelector('span[popover]')).not.toBeNull();
      endFade();
      expect(document.querySelector('span[popover]')).toBeNull();
    });
  });

  describe('with an owner that turns a context request down', () => {
    function Owned() {
      const [open, setOpen] = useState(false);
      const [refuse, setRefuse] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setRefuse(true)}>
            Refuse
          </button>
          <Menu.Root open={open} onOpenChange={(next) => (refuse && next ? undefined : setOpen(next))}>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.ContextTrigger data-testid="region">Row</Menu.ContextTrigger>
            <Menu.Content>
              <Menu.Item>Open</Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </>
      );
    }
    const menu = () => screen.getByRole('menu', { hidden: true });

    it('keeps a fading context menu where it was', () => {
      markAwareFade((el) => el.getAttribute('role') === 'menu');
      render(<Owned />);
      act(() => {
        fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 40, clientY: 50 });
      });
      const box = () => document.querySelector<HTMLElement>('span[popover]')!;
      const firstLeft = box().style.getPropertyValue('--_left');
      act(() => {
        fireEvent.keyDown(menu(), { key: 'Escape' });
      });
      // Fading at the first box. The owner now turns opens down.
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Refuse' }));
      });
      act(() => {
        fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 300, clientY: 300 });
      });
      expect(menu().hasAttribute('data-todae-exiting')).toBe(true);
      // Still fading: it should stay where it sat.
      expect(box().style.getPropertyValue('--_left')).toBe(firstLeft);
    });

    it('keeps a fading menu by its trigger', () => {
      markAwareFade((el) => el.getAttribute('role') === 'menu');
      render(<Owned />);
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
      });
      const byTrigger = menu().style.getPropertyValue('position-anchor');
      act(() => {
        fireEvent.keyDown(menu(), { key: 'Escape' });
      });
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Refuse' }));
      });
      act(() => {
        fireEvent.contextMenu(screen.getByTestId('region'), { button: 2, clientX: 300, clientY: 300 });
      });
      expect(menu().hasAttribute('data-todae-exiting')).toBe(true);
      // Its exit fade by the trigger is still drawing: it should not re-anchor to a hidden box.
      expect(menu().style.getPropertyValue('position-anchor')).toBe(byTrigger);
    });
  });
});
