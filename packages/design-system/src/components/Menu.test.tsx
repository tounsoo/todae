import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Profiler, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu, type MenuRootProps } from '../index';

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

  it('is named by its trigger only when one is mounted', () => {
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
    rerender(
      <Menu.Root defaultOpen>
        <Menu.Content>
          <Menu.Item>Rename</Menu.Item>
        </Menu.Content>
      </Menu.Root>,
    );
    expect(menu().hasAttribute('aria-labelledby')).toBe(false);
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
