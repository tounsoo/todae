import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useReorder } from './useReorder.js';

// jsdom has no layout, no DragEvent and no DataTransfer: items stand 40px tall in a column, or
// 100px wide in a row, and drag events carry a stand-in DataTransfer that lasts the drag.
// src/browser/reorder.browser.test.tsx covers the same hook with real drags in each engine.

type Orientation = 'vertical' | 'horizontal';

function List({
  onMove,
  orientation,
  disabled,
  dir,
}: {
  onMove?: (from: number, to: number) => void;
  orientation?: Orientation;
  disabled?: boolean;
  dir?: 'rtl';
}) {
  const [items, setItems] = useState(['A', 'B', 'C', 'D']);
  const reorder = useReorder({
    orientation,
    disabled,
    onMove: (from, to) => {
      onMove?.(from, to);
      setItems((list) => {
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        return next;
      });
    },
  });
  return (
    <ul data-orientation={orientation ?? 'vertical'}>
      {items.map((name, index) => (
        <li key={name} {...reorder.getItemProps(index)} style={dir ? { direction: dir } : undefined}>
          <span data-testid={`handle-${name}`} {...reorder.getHandleProps(index)}>
            ::
          </span>
          <span>{name}</span>
        </li>
      ))}
    </ul>
  );
}

const item = (name: string) => screen.getByText(name).closest('li')!;
const order = () => screen.getAllByRole('listitem').map((node) => node.textContent!.replace('::', ''));

function rectOf(li: Element): DOMRect {
  const index = [...li.parentElement!.children].indexOf(li);
  return li.parentElement!.getAttribute('data-orientation') === 'horizontal'
    ? new DOMRect(index * 100, 0, 100, 40)
    : new DOMRect(0, index * 40, 200, 40);
}

let restore: () => void = () => {};
beforeEach(() => {
  const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.tagName === 'LI' ? rectOf(this) : new DOMRect(0, 0, 0, 0);
  });
  const doc = document as Omit<Document, 'elementFromPoint'> & { elementFromPoint?: Document['elementFromPoint'] };
  const had = Object.prototype.hasOwnProperty.call(doc, 'elementFromPoint');
  const previous = doc.elementFromPoint;
  doc.elementFromPoint = (x: number, y: number) =>
    [...document.querySelectorAll('li')].find((li) => {
      const box = rectOf(li);
      return x >= box.left && x < box.right && y >= box.top && y < box.bottom;
    }) ?? null;
  restore = () => {
    rect.mockRestore();
    if (had) doc.elementFromPoint = previous;
    else delete doc.elementFromPoint;
  };
});
afterEach(() => {
  cleanup();
  restore();
});

/** A point near the start or the end of an item, along the list's axis. */
function point(name: string, side: 'start' | 'end', orientation: Orientation = 'vertical') {
  const box = rectOf(item(name));
  return orientation === 'vertical'
    ? { clientX: box.left + 5, clientY: side === 'start' ? box.top + 2 : box.bottom - 2 }
    : { clientX: side === 'start' ? box.left + 2 : box.right - 2, clientY: box.top + 5 };
}

function stubDataTransfer(types: string[] = []) {
  return {
    types,
    effectAllowed: 'uninitialized',
    dropEffect: 'none',
    setData(type: string) {
      if (!types.includes(type)) types.push(type);
    },
  };
}

function fireDrag(node: Element, type: string, dataTransfer: object, at: { clientX: number; clientY: number } = { clientX: 0, clientY: 0 }) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...at });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  act(() => {
    node.dispatchEvent(event);
  });
  return event;
}

/** A mouse drag by the browser's drag and drop: a press on the handle, then dragstart on its item. */
function mouseDrag(name: string, orientation?: Orientation) {
  const dataTransfer = stubDataTransfer();
  fireEvent.pointerDown(screen.getByTestId(`handle-${name}`), { button: 0, pointerType: 'mouse' });
  const source = item(name);
  fireDrag(source, 'dragstart', dataTransfer);
  return {
    over: (target: string, side: 'start' | 'end') => fireDrag(item(target), 'dragover', dataTransfer, point(target, side, orientation)),
    drop(target: string, side: 'start' | 'end') {
      fireDrag(item(target), 'drop', dataTransfer, point(target, side, orientation));
      fireDrag(source, 'dragend', dataTransfer);
    },
    end: () => fireDrag(source, 'dragend', dataTransfer),
  };
}

/** A finger on a handle, which drags on pointer events rather than the browser's drag. */
function touch(name: string) {
  const start = point(name, 'start');
  const fire = (target: EventTarget, type: string, at: { clientX: number; clientY: number }) =>
    act(() => {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, ...at }));
    });
  fire(screen.getByTestId(`handle-${name}`), 'pointerdown', start);
  return {
    nudge: () => fire(window, 'pointermove', { clientX: start.clientX + 1, clientY: start.clientY + 1 }),
    move: (target: string, side: 'start' | 'end') => fire(window, 'pointermove', point(target, side)),
    up: (target: string, side: 'start' | 'end') => fire(window, 'pointerup', point(target, side)),
  };
}

it('arms only the pressed item for the browser\'s drag, and disarms it when the press ends', () => {
  render(<List />);
  for (const node of screen.getAllByRole('listitem')) expect(node.getAttribute('draggable')).toBeNull();
  fireEvent.pointerDown(screen.getByTestId('handle-B'), { button: 0, pointerType: 'mouse' });
  expect(item('B').getAttribute('draggable')).toBe('true');
  expect(item('A').getAttribute('draggable')).toBeNull();
  fireEvent.pointerUp(window);
  expect(item('B').getAttribute('draggable')).toBeNull();
});

it('moves an item dragged to the side of the item it is dropped on, and says where it would land', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const d = mouseDrag('A');
  expect(item('A').getAttribute('data-dragging')).toBe('');
  const over = d.over('C', 'end');
  expect(over.defaultPrevented).toBe(true);
  expect(item('C').getAttribute('data-drop')).toBe('after');
  d.over('C', 'start');
  expect(item('C').getAttribute('data-drop')).toBe('before');
  d.drop('C', 'end');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(0, 2);
  expect(order()).toEqual(['B', 'C', 'A', 'D']);
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  expect(item('C').getAttribute('data-drop')).toBeNull();
});

it('shows nothing and moves nothing for a drop that would leave the item where it is', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const d = mouseDrag('B');
  d.over('A', 'end');
  expect(item('A').getAttribute('data-drop')).toBeNull();
  d.over('C', 'start');
  expect(item('C').getAttribute('data-drop')).toBeNull();
  d.drop('C', 'start');
  expect(onMove).not.toHaveBeenCalled();
  expect(order()).toEqual(['A', 'B', 'C', 'D']);
});

it('ignores a drag it did not start, such as a file', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const file = stubDataTransfer(['Files']);
  const over = fireDrag(item('C'), 'dragover', file, point('C', 'end'));
  expect(over.defaultPrevented).toBe(false);
  expect(item('C').getAttribute('data-drop')).toBeNull();
  fireDrag(item('C'), 'drop', file, point('C', 'end'));
  expect(onMove).not.toHaveBeenCalled();
});

it('ignores another drag, such as a file, over the list during its own', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const d = mouseDrag('A');
  const file = stubDataTransfer(['Files']);
  const over = fireDrag(item('C'), 'dragover', file, point('C', 'end'));
  expect(over.defaultPrevented).toBe(false);
  expect(item('C').getAttribute('data-drop')).toBeNull();
  fireDrag(item('C'), 'drop', file, point('C', 'end'));
  expect(onMove).not.toHaveBeenCalled();
  d.end();
});

it('takes the side in a horizontal list from the text direction', () => {
  const onMove = vi.fn();
  const { unmount } = render(<List orientation="horizontal" onMove={onMove} />);
  let d = mouseDrag('A', 'horizontal');
  d.over('C', 'end');
  expect(item('C').getAttribute('data-drop')).toBe('after');
  d.end();
  unmount();

  render(<List orientation="horizontal" dir="rtl" onMove={onMove} />);
  d = mouseDrag('A', 'horizontal');
  // Right to left, the right edge comes first.
  d.over('C', 'end');
  expect(item('C').getAttribute('data-drop')).toBe('before');
  d.drop('C', 'start');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(0, 2);
});

it('starts no drag when disabled, and refuses the drop of one under way', () => {
  const onMove = vi.fn();
  const { rerender } = render(<List onMove={onMove} />);
  const d = mouseDrag('A');
  rerender(<List onMove={onMove} disabled />);
  d.over('C', 'end');
  expect(item('C').getAttribute('data-drop')).toBeNull();
  d.drop('C', 'end');
  expect(onMove).not.toHaveBeenCalled();
  fireEvent.pointerDown(screen.getByTestId('handle-B'), { button: 0, pointerType: 'mouse' });
  expect(item('B').getAttribute('draggable')).toBeNull();
});

it('moves an item a finger drags, once the finger moves off the press', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const t = touch('A');
  expect(item('A').getAttribute('draggable')).toBeNull();
  t.nudge();
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  t.move('C', 'end');
  expect(item('A').getAttribute('data-dragging')).toBe('');
  expect(item('C').getAttribute('data-drop')).toBe('after');
  t.up('C', 'end');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(0, 2);
  expect(order()).toEqual(['B', 'C', 'A', 'D']);
  expect(item('A').getAttribute('data-dragging')).toBeNull();
});

it('starts no drag and drops nothing for a press that never moves past a small slop', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const t = touch('A');
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  t.nudge();
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  // Released over another item, still no drop, since no drag started.
  t.up('C', 'end');
  expect(onMove).not.toHaveBeenCalled();
});

it('cancels a touch drag on Escape', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const t = touch('A');
  t.move('C', 'end');
  expect(item('C').getAttribute('data-drop')).toBe('after');
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  expect(item('C').getAttribute('data-drop')).toBeNull();
  t.up('C', 'end');
  expect(onMove).not.toHaveBeenCalled();
});
