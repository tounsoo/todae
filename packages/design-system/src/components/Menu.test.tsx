import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
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
const key = (k: string, target: Element = document.activeElement!) => fireEvent.keyDown(target, { key: k });
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
    expect(document.activeElement).toBe(item('Delete'));
    key('Escape');
    await raf();
    expect(isOpen()).toBe(false);
    key('ArrowDown', trigger());
    await raf();
    expect(document.activeElement).toBe(item('Rename'));
  });

  it('moves with arrows, skips disabled items, loops, and uses typeahead', async () => {
    render(<Actions />);
    fireEvent.click(trigger());
    await raf();
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Delete'));
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

  it('closes on Tab with reason tab', async () => {
    const onOpenChange = vi.fn();
    render(<Actions onOpenChange={onOpenChange} />);
    fireEvent.click(trigger());
    await raf();
    key('Tab');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'tab');
    expect(isOpen()).toBe(false);
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
