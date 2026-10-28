import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { cdp, server, userEvent } from '@vitest/browser/context';
import { useState, type PointerEvent } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { Dialog, useReorder } from '../index.js';

afterEach(cleanup);

type ListProps = {
  onMove?: (from: number, to: number) => void;
  items?: string[];
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  dir?: 'ltr' | 'rtl';
  onDragOver?: () => void;
};

function List({ onMove, items: initial = ['A', 'B', 'C', 'D'], orientation, disabled, dir, onDragOver }: ListProps) {
  const [items, setItems] = useState(initial);
  const horizontal = orientation === 'horizontal';
  const reorder = useReorder({
    orientation,
    disabled,
    onMove: (from, to) => {
      onMove?.(from, to);
      setItems((list) => {
        const next = [...list];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item!);
        return next;
      });
    },
  });
  return (
    <ul dir={dir} style={{ inlineSize: horizontal ? 400 : 200, padding: 0, margin: 0, listStyle: 'none', display: horizontal ? 'flex' : 'block' }}>
      {items.map((item, index) => (
        <li key={item} {...reorder.getItemProps(index, { onDragOver })} style={{ blockSize: 40, inlineSize: horizontal ? 100 : undefined, display: 'flex' }}>
          <span data-testid={`handle-${item}`} {...reorder.getHandleProps(index)} style={{ inlineSize: 24 }}>
            ::
          </span>
          <span data-testid={`text-${item}`}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// A list whose items come from props, so a test can change them during a drag.
function Controlled({ items, onMove }: { items: string[]; onMove: (from: number, to: number) => void }) {
  const reorder = useReorder({ onMove });
  return (
    <ul style={{ inlineSize: 200, padding: 0, margin: 0, listStyle: 'none' }}>
      {items.map((item, index) => (
        <li key={item} {...reorder.getItemProps(index)} style={{ blockSize: 40, display: 'flex' }}>
          <span data-testid={`handle-${item}`} {...reorder.getHandleProps(index)} style={{ inlineSize: 24 }}>
            ::
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Grip({ onPointerDown }: { onPointerDown: (event: PointerEvent<HTMLElement>) => void }) {
  const reorder = useReorder({ onMove: () => {} });
  return (
    <ul>
      <li data-testid="item" {...reorder.getItemProps(0)}>
        <span data-testid="grip" {...reorder.getHandleProps(0, { onPointerDown })}>
          ::
        </span>
      </li>
    </ul>
  );
}

const order = () => screen.getAllByRole('listitem').map((item) => item.textContent?.replace('::', ''));
const top = { x: 100, y: 5 };
const bottom = { x: 100, y: 35 };

it('moves an item dragged by its handle to the side of the item it is dropped on', async () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  await userEvent.dragAndDrop(screen.getByTestId('handle-A'), screen.getByText('C').closest('li')!, {
    targetPosition: bottom,
  });
  expect(onMove).toHaveBeenCalledWith(0, 2);
  expect(order()).toEqual(['B', 'C', 'A', 'D']);

  await userEvent.dragAndDrop(screen.getByTestId('handle-D'), screen.getByText('B').closest('li')!, {
    targetPosition: top,
  });
  expect(order()).toEqual(['D', 'B', 'C', 'A']);
});

it('does nothing for a drop that would leave the item where it is', async () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  await userEvent.dragAndDrop(screen.getByTestId('handle-B'), screen.getByText('A').closest('li')!, {
    targetPosition: bottom,
  });
  expect(onMove).not.toHaveBeenCalled();
  expect(order()).toEqual(['A', 'B', 'C', 'D']);
});

it('starts a drag only from a handle', async () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  await userEvent.dragAndDrop(screen.getByTestId('text-A'), screen.getByText('C').closest('li')!, {
    targetPosition: bottom,
  });
  expect(onMove).not.toHaveBeenCalled();
  for (const item of screen.getAllByRole('listitem')) expect(item).not.toHaveAttribute('draggable');
});

// fireEvent gives each event a new DataTransfer, so dispatch drag events with one that lasts the drag.
function fireDrag(node: Element, type: string, init: DragEventInit) {
  act(() => {
    node.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, ...init }));
  });
}

// Steps a drag by hand, for what userEvent.dragAndDrop can't stop between: a press on the handle,
// dragstart, then dragover and drop at a point of the target.
function drag(handle: string) {
  const dataTransfer = new DataTransfer();
  fireEvent.pointerDown(screen.getByTestId(`handle-${handle}`), { button: 0 });
  const source = screen.getByTestId(`handle-${handle}`).closest('li')!;
  fireDrag(source, 'dragstart', { dataTransfer });
  const at = (name: string, side: 'start' | 'end', axis: 'x' | 'y' = 'y') => {
    const rect = screen.getByText(name).closest('li')!.getBoundingClientRect();
    const near = axis === 'y' ? { clientX: rect.left + 5, clientY: side === 'start' ? rect.top + 2 : rect.bottom - 2 } : { clientX: side === 'start' ? rect.left + 2 : rect.right - 2, clientY: rect.top + 5 };
    return { target: screen.getByText(name).closest('li')!, init: { dataTransfer, ...near } };
  };
  return {
    dataTransfer,
    over(name: string, side: 'start' | 'end', axis?: 'x' | 'y') {
      const { target, init } = at(name, side, axis);
      fireDrag(target, 'dragover', init);
      return target;
    },
    drop(name: string, side: 'start' | 'end', axis?: 'x' | 'y') {
      const { target, init } = at(name, side, axis);
      fireDrag(target, 'drop', init);
      fireDrag(source, 'dragend', { dataTransfer });
    },
    end() {
      fireDrag(source, 'dragend', { dataTransfer });
    },
  };
}

const item = (name: string) => screen.getByText(name).closest('li')!;

it('says where the dragged item would land, and nothing where a drop would not move it', () => {
  render(<List />);
  const d = drag('B');
  expect(item('B')).toHaveAttribute('data-dragging', '');
  d.over('C', 'end');
  expect(item('C')).toHaveAttribute('data-drop', 'after');
  d.over('C', 'start');
  expect(item('C')).not.toHaveAttribute('data-drop');
  d.over('A', 'end');
  expect(item('A')).not.toHaveAttribute('data-drop');
  d.over('A', 'start');
  expect(item('A')).toHaveAttribute('data-drop', 'before');
  d.end();
  expect(item('A')).not.toHaveAttribute('data-drop');
  expect(item('B')).not.toHaveAttribute('data-dragging');
});

it('clears the line when the drag leaves the item', () => {
  render(<List />);
  const d = drag('A');
  d.over('C', 'end');
  expect(item('C')).toHaveAttribute('data-drop', 'after');
  fireDrag(item('C'), 'dragleave', { clientX: 400, clientY: 400 });
  expect(item('C')).not.toHaveAttribute('data-drop');
  d.end();
});

it('ignores a drag this list did not start, such as another list\'s item or a file', () => {
  const first = vi.fn();
  const second = vi.fn();
  render(
    <>
      <List onMove={first} />
      <List onMove={second} items={['W', 'X', 'Y', 'Z']} />
    </>,
  );
  const d = drag('A');
  const target = d.over('Y', 'end');
  expect(target).not.toHaveAttribute('data-drop');
  d.drop('Y', 'end');
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();

  const file = new DataTransfer();
  file.items.add(new File(['x'], 'x.txt', { type: 'text/plain' }));
  fireDrag(item('C'), 'dragover', { dataTransfer: file, clientX: 5, clientY: item('C').getBoundingClientRect().bottom - 2 });
  expect(item('C')).not.toHaveAttribute('data-drop');
});

it('takes the side in a horizontal list from the text direction', () => {
  const onMove = vi.fn();
  const { unmount } = render(<List orientation="horizontal" onMove={onMove} />);
  let d = drag('A');
  d.over('C', 'end', 'x');
  expect(item('C')).toHaveAttribute('data-drop', 'after');
  d.drop('C', 'end', 'x');
  expect(onMove).toHaveBeenLastCalledWith(0, 2);
  unmount();
  onMove.mockClear();

  render(<List orientation="horizontal" dir="rtl" onMove={onMove} />);
  d = drag('A');
  // In a right-to-left list the text starts at the right, so the right edge is before.
  d.over('C', 'end', 'x');
  expect(item('C')).toHaveAttribute('data-drop', 'before');
  d.drop('C', 'start', 'x');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(0, 2);
});

it('starts no drag when disabled, and refuses the drop of one under way', () => {
  const onMove = vi.fn();
  const { rerender } = render(<List onMove={onMove} />);
  const d = drag('A');
  d.over('C', 'end');
  rerender(<List onMove={onMove} disabled />);
  d.over('C', 'end');
  expect(item('C')).not.toHaveAttribute('data-drop');
  d.drop('C', 'end');
  expect(onMove).not.toHaveBeenCalled();

  fireEvent.pointerDown(screen.getByTestId('handle-B'), { button: 0 });
  expect(item('B')).not.toHaveAttribute('draggable');
});

it('moves the dragged item when the list changes during the drag', () => {
  const onMove = vi.fn();
  const { rerender } = render(<Controlled onMove={onMove} items={['A', 'B', 'C', 'D']} />);
  const d = drag('B');
  // Another device adds an item at the top: B is now at index 2.
  rerender(<Controlled onMove={onMove} items={['N', 'A', 'B', 'C', 'D']} />);
  expect(item('B')).toHaveAttribute('data-dragging', '');
  expect(item('B')).toHaveAttribute('draggable', 'true');
  expect(item('A')).not.toHaveAttribute('data-dragging');
  d.drop('D', 'end');
  expect(onMove).toHaveBeenCalledWith(2, 4);
});

it('forgets a drag whose item was removed, and then ignores drags it did not start', () => {
  const onMove = vi.fn();
  const { rerender } = render(<Controlled onMove={onMove} items={['A', 'B', 'C', 'D']} />);
  const d = drag('B');
  rerender(<Controlled onMove={onMove} items={['A', 'C', 'D']} />);
  for (const node of screen.getAllByRole('listitem')) {
    expect(node).not.toHaveAttribute('data-dragging');
    expect(node).not.toHaveAttribute('draggable');
  }
  // The drag's own data, still in the browser's hands, no longer reaches the list.
  d.over('C', 'end');
  expect(item('C')).not.toHaveAttribute('data-drop');
  d.drop('C', 'end');
  expect(onMove).not.toHaveBeenCalled();
});

it('ignores another type, or a file dropped, during its own drag', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const d = drag('B');
  const rect = item('D').getBoundingClientRect();
  fireDrag(item('D'), 'dragover', { dataTransfer: new DataTransfer(), clientX: rect.left + 5, clientY: rect.bottom - 2 });
  expect(item('D')).not.toHaveAttribute('data-drop');
  const file = new DataTransfer();
  file.items.add(new File(['x'], 'x.txt', { type: 'text/plain' }));
  fireDrag(item('D'), 'drop', { dataTransfer: file, clientX: rect.left + 5, clientY: rect.bottom - 2 });
  expect(onMove).not.toHaveBeenCalled();
  expect(item('B')).toHaveAttribute('data-dragging', '');
  d.drop('D', 'end');
  expect(onMove).toHaveBeenCalledWith(1, 3);
});

it('ends a drag whose item left the page without a render, on the next pointer move', () => {
  render(<List />);
  const d = drag('B');
  item('B').remove();
  d.over('C', 'end');
  expect(item('C')).not.toHaveAttribute('data-drop');
  for (const node of screen.getAllByRole('listitem')) expect(node).not.toHaveAttribute('data-dragging');
  cleanup();

  render(<List />);
  drag('B');
  item('B').remove();
  act(() => {
    window.dispatchEvent(new PointerEvent('pointermove'));
  });
  for (const node of screen.getAllByRole('listitem')) expect(node).not.toHaveAttribute('data-dragging');
});

it('runs the caller\'s own handlers with its own, and skips its own after one that prevents the default', () => {
  const onPointerDown = vi.fn();
  render(<Grip onPointerDown={onPointerDown} />);
  fireEvent.pointerDown(screen.getByTestId('grip'), { button: 0 });
  expect(onPointerDown).toHaveBeenCalled();
  expect(screen.getByTestId('item')).toHaveAttribute('draggable', 'true');
  fireEvent.pointerUp(window);
  cleanup();

  render(<Grip onPointerDown={(event) => event.preventDefault()} />);
  fireEvent.pointerDown(screen.getByTestId('grip'), { button: 0 });
  expect(screen.getByTestId('item')).not.toHaveAttribute('draggable');
  cleanup();

  const onDragOver = vi.fn();
  render(<List onDragOver={onDragOver} />);
  const d = drag('A');
  d.over('C', 'end');
  expect(onDragOver).toHaveBeenCalled();
  expect(item('C')).toHaveAttribute('data-drop', 'after');
  d.end();
});

it('leaves the order alone when the browser cancels a drag, as it does on Escape', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const d = drag('A');
  d.over('C', 'end');
  expect(item('C')).toHaveAttribute('data-drop', 'after');
  // A cancelled drag sends dragleave to the item under the pointer, with the pointer still on it,
  // then dragend, and no drop.
  const rect = item('C').getBoundingClientRect();
  fireDrag(item('C'), 'dragleave', { dataTransfer: d.dataTransfer, clientX: rect.left + 5, clientY: rect.bottom - 2 });
  // The pointer is still on C, so the line stays until dragend.
  expect(item('C')).toHaveAttribute('data-drop', 'after');
  d.end();
  expect(onMove).not.toHaveBeenCalled();
  expect(item('C')).not.toHaveAttribute('data-drop');
  expect(item('A')).not.toHaveAttribute('data-dragging');
  expect(item('A')).not.toHaveAttribute('draggable');
});

type Session = {
  send(method: string, params?: object): Promise<unknown>;
  on(event: string, listener: (params: never) => void): void;
  off(event: string, listener: (params: never) => void): void;
};
const session = () => cdp() as unknown as Session;

// CDP takes points on the page that holds the test's frame, which is scaled to fit it.
function onPage(x: number, y: number) {
  const frame = window.frameElement!.getBoundingClientRect();
  const scale = frame.width / window.innerWidth;
  return { x: frame.left + x * scale, y: frame.top + y * scale };
}
const centre = (node: Element, side: 'start' | 'end' = 'end') => {
  const rect = node.getBoundingClientRect();
  return onPage(rect.left + rect.width / 2, side === 'start' ? rect.top + 4 : rect.bottom - 4);
};

it.runIf(server.browser === 'chromium')('leaves the order alone when Chromium cancels a real drag', async () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const s = session();
  let listener: (params: { data: object }) => void = () => {};
  const intercepted = new Promise<{ data: object }>((resolve, reject) => {
    listener = resolve;
    setTimeout(() => reject(new Error('Chromium intercepted no drag')), 2000);
  });
  await s.send('Input.setInterceptDrags', { enabled: true });
  s.on('Input.dragIntercepted', listener);
  // Awaited below; a failure before then must not leave the timeout's rejection unhandled.
  intercepted.catch(() => {});
  try {
    const from = centre(screen.getByTestId('handle-A'));
    const to = centre(item('C'));
    await s.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...from, button: 'left', buttons: 1, clickCount: 1 });
    await s.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y + 10, button: 'left', buttons: 1 });
    await s.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...to, button: 'left', buttons: 1 });
    const { data } = await intercepted;
    await s.send('Input.dispatchDragEvent', { type: 'dragEnter', ...to, data });
    await s.send('Input.dispatchDragEvent', { type: 'dragOver', ...to, data });
    await expect.poll(() => item('C').getAttribute('data-drop')).toBe('after');
    // What the browser does on Escape during a drag.
    await s.send('Input.dispatchDragEvent', { type: 'dragCancel', ...to, data });
    await expect.poll(() => item('A').hasAttribute('data-dragging')).toBe(false);
    expect(item('C')).not.toHaveAttribute('data-drop');
    expect(onMove).not.toHaveBeenCalled();
    expect(order()).toEqual(['A', 'B', 'C', 'D']);
  } finally {
    s.off('Input.dragIntercepted', listener);
    await s.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 0, y: 0, button: 'left', buttons: 0, clickCount: 1 });
    await s.send('Input.setInterceptDrags', { enabled: false });
  }
});

// A finger on a handle, stepped with pointer events as a touch screen sends them.
function touch(handle: string, pointerId = 7, pointerType = 'touch', isPrimary = true) {
  const grip = screen.getByTestId(`handle-${handle}`);
  const fire = (target: EventTarget, type: string, x: number, y: number) =>
    act(() => {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType, isPrimary, button: type === 'pointermove' ? -1 : 0, clientX: x, clientY: y }));
    });
  const point = (name: string, side: 'start' | 'end') => {
    const rect = item(name).getBoundingClientRect();
    return [rect.left + 40, side === 'start' ? rect.top + 2 : rect.bottom - 2] as const;
  };
  const start = grip.getBoundingClientRect();
  fire(grip, 'pointerdown', start.left + 4, start.top + 4);
  return {
    move(name: string, side: 'start' | 'end') {
      fire(grip, 'pointermove', ...point(name, side));
    },
    up(name: string, side: 'start' | 'end') {
      fire(grip, 'pointerup', ...point(name, side));
    },
    cancel() {
      fire(grip, 'pointercancel', 0, 0);
    },
  };
}

it('arms an item on a mousedown with no pointerdown, as WebKit sends the press after a drag, but not after a tap', () => {
  render(<List />);
  fireEvent.mouseDown(screen.getByTestId('handle-B'), { button: 0 });
  expect(item('B')).toHaveAttribute('draggable', 'true');
  fireEvent.mouseUp(window);
  expect(item('B')).not.toHaveAttribute('draggable');
  fireEvent.mouseDown(screen.getByTestId('handle-B'), { button: 0 });
  fireEvent.pointerUp(window);
  expect(item('B')).not.toHaveAttribute('draggable');

  // A tap sends its mousedown after pointerup.
  touch('C').up('C', 'start');
  fireEvent.mouseDown(screen.getByTestId('handle-C'), { button: 0 });
  expect(item('C')).not.toHaveAttribute('draggable');
});

it('moves an item a finger drags by its handle, without the browser\'s drag', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const t = touch('A');
  expect(item('A')).not.toHaveAttribute('draggable');
  expect(item('A')).not.toHaveAttribute('data-dragging');
  t.move('C', 'end');
  expect(item('A')).toHaveAttribute('data-dragging', '');
  expect(item('C')).toHaveAttribute('data-drop', 'after');
  t.move('B', 'start');
  // Before B is where A already is.
  expect(item('B')).not.toHaveAttribute('data-drop');
  t.up('C', 'end');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(0, 2);
  expect(order()).toEqual(['B', 'C', 'A', 'D']);
  expect(item('A')).not.toHaveAttribute('data-dragging');
});

it('drags a pen as it drags a finger', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const grip = screen.getByTestId('handle-A');
  const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'pen', isPrimary: true, button: 0 });
  act(() => {
    grip.dispatchEvent(down);
  });
  // No mouse events follow, so the drag selects no text.
  expect(down.defaultPrevented).toBe(true);
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, pointerType: 'pen' }));
  });
  const t = touch('A', 3, 'pen');
  expect(item('A')).not.toHaveAttribute('draggable');
  t.move('C', 'end');
  expect(item('C')).toHaveAttribute('data-drop', 'after');
  t.up('C', 'end');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(0, 2);
});

it('starts no touch drag when disabled before the finger moves', () => {
  const onMove = vi.fn();
  const { rerender } = render(<List onMove={onMove} />);
  const t = touch('A');
  rerender(<List onMove={onMove} disabled />);
  t.move('C', 'end');
  expect(item('A')).not.toHaveAttribute('data-dragging');
  t.up('C', 'end');
  expect(onMove).not.toHaveBeenCalled();
});

it('lets a mouse press end a touch drag whose pointerup never came, and leaves the touched item unarmed', () => {
  render(<List />);
  // A mouse press that left B armed, as a press with no release can.
  fireEvent.pointerDown(screen.getByTestId('handle-B'), { button: 0, pointerType: 'mouse' });
  const t = touch('A');
  expect(item('A')).not.toHaveAttribute('draggable');
  expect(item('B')).not.toHaveAttribute('draggable');
  t.move('C', 'end');
  expect(item('A')).toHaveAttribute('data-dragging', '');
  fireEvent.pointerDown(screen.getByTestId('handle-D'), { button: 0, pointerType: 'mouse' });
  expect(item('A')).not.toHaveAttribute('data-dragging');
  expect(item('C')).not.toHaveAttribute('data-drop');
  expect(item('D')).toHaveAttribute('draggable', 'true');
  // The lost pointerup, if it comes late, starts and drops nothing, and a finger drags again.
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch' }));
  });
  fireEvent.pointerUp(window);
  const again = touch('B', 8);
  again.move('D', 'end');
  expect(item('D')).toHaveAttribute('data-drop', 'after');
  again.up('D', 'end');
  expect(order()).toEqual(['A', 'C', 'D', 'B']);
});

it('lets a new first finger end a touch drag whose pointerup never came', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  touch('A').move('C', 'end');
  const t = touch('B', 8);
  expect(item('A')).not.toHaveAttribute('data-dragging');
  t.move('D', 'end');
  expect(item('B')).toHaveAttribute('data-dragging', '');
  t.up('D', 'end');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(1, 3);
});

it('drops nothing for a tap, a lift outside the list, or a touch the browser cancels', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  let t = touch('A');
  t.up('A', 'start');
  expect(item('A')).not.toHaveAttribute('data-dragging');

  t = touch('A');
  t.move('C', 'end');
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: 600, clientY: 600 }));
  });
  expect(item('A')).not.toHaveAttribute('data-dragging');
  expect(item('C')).not.toHaveAttribute('data-drop');

  t = touch('A');
  t.move('C', 'end');
  t.cancel();
  expect(item('C')).not.toHaveAttribute('data-drop');
  expect(item('A')).not.toHaveAttribute('data-dragging');
  expect(onMove).not.toHaveBeenCalled();
});

it('ignores another finger, and refuses a touch drop once disabled', () => {
  const onMove = vi.fn();
  const { rerender } = render(<List onMove={onMove} />);
  const t = touch('A');
  t.move('C', 'end');
  // A second finger on another handle starts nothing.
  touch('D', 9, 'touch', false).up('B', 'start');
  expect(onMove).not.toHaveBeenCalled();
  expect(item('A')).toHaveAttribute('data-dragging', '');
  rerender(<List onMove={onMove} disabled />);
  t.move('C', 'end');
  expect(item('C')).not.toHaveAttribute('data-drop');
  t.up('C', 'end');
  expect(onMove).not.toHaveBeenCalled();
});

it('cancels a touch drag on Escape, before a dialog around the list closes', async () => {
  const onMove = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <Dialog.Root open onOpenChange={onOpenChange} aria-label="Channels">
      <List onMove={onMove} />
    </Dialog.Root>,
  );
  const t = touch('A');
  t.move('C', 'end');
  expect(item('C')).toHaveAttribute('data-drop', 'after');
  await userEvent.keyboard('{Escape}');
  expect(item('A')).not.toHaveAttribute('data-dragging');
  expect(item('C')).not.toHaveAttribute('data-drop');
  t.up('C', 'end');
  expect(onMove).not.toHaveBeenCalled();
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(onOpenChange).not.toHaveBeenCalled();
  await userEvent.keyboard('{Escape}');
  await expect.poll(() => onOpenChange.mock.calls[0]).toEqual([false, 'escape']);
});

it('moves the item a touch drags when the list changes during the drag, and ends it when the item goes', () => {
  const onMove = vi.fn();
  const { rerender } = render(<Controlled onMove={onMove} items={['A', 'B', 'C', 'D']} />);
  let t = touch('B');
  t.move('D', 'end');
  rerender(<Controlled onMove={onMove} items={['N', 'A', 'B', 'C', 'D']} />);
  expect(item('B')).toHaveAttribute('data-dragging', '');
  t.up('D', 'end');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(2, 4);

  onMove.mockClear();
  t = touch('B');
  t.move('D', 'end');
  rerender(<Controlled onMove={onMove} items={['N', 'A', 'C', 'D']} />);
  for (const node of screen.getAllByRole('listitem')) expect(node).not.toHaveAttribute('data-dragging');
  t.up('D', 'end');
  expect(onMove).not.toHaveBeenCalled();
});

it('takes a touch drop only from its own list, not a list nested in an item', () => {
  const onMove = vi.fn();
  const inner = vi.fn();
  function Nested() {
    const reorder = useReorder({ onMove });
    return (
      <ul style={{ inlineSize: 200, padding: 0, margin: 0, listStyle: 'none' }}>
        {['A', 'B'].map((name, index) => (
          <li key={name} {...reorder.getItemProps(index)}>
            <span data-testid={`handle-${name}`} {...reorder.getHandleProps(index)} style={{ display: 'block', blockSize: 20 }}>
              ::
            </span>
            <span>{name}</span>
            {index === 1 && <List onMove={inner} items={['X', 'Y']} />}
          </li>
        ))}
      </ul>
    );
  }
  render(<Nested />);
  const t = touch('A');
  // X sits inside B, so a drop on it lands beside B, its own list's item. Read as the inner list's
  // index 0, it would be A's own place and land nowhere.
  t.move('X', 'end');
  expect(screen.getByText('B').closest('li')).toHaveAttribute('data-drop', 'after');
  t.up('X', 'end');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(0, 1);
  expect(inner).not.toHaveBeenCalled();
});

it.runIf(server.browser === 'chromium')('moves an item a real touch drags in Chromium', async () => {
  const onMove = vi.fn();
  render(
    <div style={{ touchAction: 'none' }}>
      <List onMove={onMove} />
    </div>,
  );
  const s = session();
  const from = centre(screen.getByTestId('handle-A'), 'start');
  const to = centre(item('C'));
  try {
    await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
    await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y: from.y + 20, id: 1 }] });
    await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...to, id: 1 }] });
    await expect.poll(() => item('C').getAttribute('data-drop')).toBe('after');
  } finally {
    await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await expect.poll(() => onMove.mock.calls).toEqual([[0, 2]]);
  expect(order()).toEqual(['B', 'C', 'A', 'D']);
});
