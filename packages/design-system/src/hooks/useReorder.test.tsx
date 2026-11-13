import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { memo, useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  useReorder,
  useReorderGroup,
  type ReorderGroup,
  type ReorderPlace,
  type UseReorderHandleProps,
  type UseReorderItemProps,
} from './useReorder.js';

// jsdom has no layout, no DragEvent and no DataTransfer: items stand 40px tall in a column, or
// 100px wide in a row, and drag events carry a stand-in DataTransfer that lasts the drag.
// src/browser/reorder.browser.test.tsx covers the same hook with real drags in each engine.

type Orientation = 'vertical' | 'horizontal';

// The names of the memoized rows that rendered, in order.
let renders: string[] = [];
const rendered = () => {
  const names = renders;
  renders = [];
  return names;
};

/** A row the way a long list draws it: memoized, with its item props spread and its handle's props as one prop. */
const Row = memo(function Row({ name, grip, ...item }: UseReorderItemProps & { name: string; grip: UseReorderHandleProps }) {
  renders.push(name);
  return (
    <li {...item}>
      <span data-testid={`handle-${name}`} {...grip}>
        ::
      </span>
      <span>{name}</span>
    </li>
  );
});

function List({
  onMove,
  orientation,
  disabled,
  dir,
  memoized,
}: {
  onMove?: (from: number, to: number) => void;
  orientation?: Orientation;
  disabled?: boolean;
  dir?: 'rtl';
  /** Draw the items as memoized rows. */
  memoized?: boolean;
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
      {items.map((name, index) =>
        memoized ? (
          <Row key={name} {...reorder.getItemProps(index)} name={name} grip={reorder.getHandleProps(index)} />
        ) : (
          <li key={name} {...reorder.getItemProps(index)} style={dir ? { direction: dir } : undefined}>
            <span data-testid={`handle-${name}`} {...reorder.getHandleProps(index)}>
              ::
            </span>
            <span>{name}</span>
          </li>
        ),
      )}
    </ul>
  );
}

const item = (name: string) => screen.getByText(name).closest('li')!;
const order = () => screen.getAllByRole('listitem').map((node) => node.textContent!.replace('::', ''));

// A list with data-x stands that far to the right, so lists of a group sit side by side.
const leftOf = (list: Element) => Number(list.getAttribute('data-x') ?? 0);

function rectOf(li: Element): DOMRect {
  const index = [...li.parentElement!.children].indexOf(li);
  const x = leftOf(li.parentElement!);
  return li.parentElement!.getAttribute('data-orientation') === 'horizontal'
    ? new DOMRect(x + index * 100, 0, 100, 40)
    : new DOMRect(x, index * 40, 200, 40);
}

// A list stands 200px wide and 400px tall, so it has room below its items.
const listRect = (ul: Element) => new DOMRect(leftOf(ul), 0, 200, 400);

let restore: () => void = () => {};
beforeEach(() => {
  const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.tagName === 'LI') return rectOf(this);
    return this.tagName === 'UL' ? listRect(this) : new DOMRect(0, 0, 0, 0);
  });
  const doc = document as Omit<Document, 'elementFromPoint'> & { elementFromPoint?: Document['elementFromPoint'] };
  const had = Object.prototype.hasOwnProperty.call(doc, 'elementFromPoint');
  const previous = doc.elementFromPoint;
  const at = (box: DOMRect, x: number, y: number) => x >= box.left && x < box.right && y >= box.top && y < box.bottom;
  doc.elementFromPoint = (x: number, y: number) =>
    [...document.querySelectorAll('li')].find((li) => at(rectOf(li), x, y)) ??
    [...document.querySelectorAll('ul')].find((ul) => at(listRect(ul), x, y)) ??
    null;
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
    /** A drag event of this drag on any element, such as a list, at a point. */
    on: (node: Element, type: string, at: { clientX: number; clientY: number }) => fireDrag(node, type, dataTransfer, at),
  };
}

/** A finger on a handle, which drags on pointer events rather than the browser's drag. */
function touch(name: string, orientation?: Orientation) {
  const start = point(name, 'start', orientation);
  const fire = (target: EventTarget, type: string, at: { clientX: number; clientY: number }, pointerId = 7) =>
    act(() => {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType: 'touch', isPrimary: pointerId === 7, button: 0, ...at }));
    });
  fire(screen.getByTestId(`handle-${name}`), 'pointerdown', start);
  return {
    nudge: () => fire(window, 'pointermove', { clientX: start.clientX + 1, clientY: start.clientY + 1 }),
    /** A move this far along x from the press. */
    by: (dx: number) => fire(window, 'pointermove', { clientX: start.clientX + dx, clientY: start.clientY }),
    move: (target: string, side: 'start' | 'end', pointerId?: number) => fire(window, 'pointermove', point(target, side, orientation), pointerId),
    up: (target: string, side: 'start' | 'end', pointerId?: number) => fire(window, 'pointerup', point(target, side, orientation), pointerId),
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

it('ignores another drag, such as a file, over the list during its own, which goes on', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const d = mouseDrag('A');
  const file = stubDataTransfer(['Files']);
  const over = fireDrag(item('C'), 'dragover', file, point('C', 'end'));
  expect(over.defaultPrevented).toBe(false);
  expect(item('C').getAttribute('data-drop')).toBeNull();
  const drop = fireDrag(item('C'), 'drop', file, point('C', 'end'));
  expect(drop.defaultPrevented).toBe(false);
  expect(onMove).not.toHaveBeenCalled();
  expect(item('A').getAttribute('data-dragging')).toBe('');
  d.drop('C', 'end');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(0, 2);
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

it('arms nothing while disabled, and lets no item armed before that drag', () => {
  const { rerender } = render(<List />);
  fireEvent.pointerDown(screen.getByTestId('handle-A'), { button: 0, pointerType: 'mouse' });
  rerender(<List disabled />);
  expect(item('A').getAttribute('draggable')).toBeNull();
  // The browser can still start the drag it armed before the change; the list refuses it.
  const dataTransfer = stubDataTransfer();
  fireDrag(item('A'), 'dragstart', dataTransfer);
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  expect(dataTransfer.types).toEqual([]);
  fireEvent.pointerUp(window);

  // A press while disabled is forgotten, not armed for when the list is enabled again.
  fireEvent.pointerDown(screen.getByTestId('handle-B'), { button: 0, pointerType: 'mouse' });
  fireEvent.mouseDown(screen.getByTestId('handle-B'), { button: 0 });
  rerender(<List />);
  expect(item('B').getAttribute('draggable')).toBeNull();
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

it('starts a finger drag once the finger moves 4px from the press', () => {
  render(<List orientation="horizontal" />);
  const t = touch('A', 'horizontal');
  t.by(3);
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  t.by(4);
  expect(item('A').getAttribute('data-dragging')).toBe('');
});

it('takes the side in a horizontal finger drag from the text direction', () => {
  render(<List orientation="horizontal" dir="rtl" />);
  const t = touch('A', 'horizontal');
  t.move('C', 'end');
  expect(item('C').getAttribute('data-drop')).toBe('before');
});

it('keeps a finger drag through another finger lifting or cancelling', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const t = touch('A');
  t.move('C', 'end');
  t.up('B', 'end', 9);
  act(() => {
    window.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 9, pointerType: 'touch' }));
  });
  expect(item('A').getAttribute('data-dragging')).toBe('');
  expect(onMove).not.toHaveBeenCalled();
  t.up('C', 'end');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(0, 2);
});

it('follows only the finger that pressed', () => {
  const onMove = vi.fn();
  render(<List onMove={onMove} />);
  const t = touch('A');
  t.move('C', 'end', 9);
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  t.up('C', 'end', 9);
  t.up('C', 'end');
  expect(onMove).not.toHaveBeenCalled();
});

it('starts no finger drag once disabled, and refuses the drop of one under way', () => {
  const onMove = vi.fn();
  const { rerender } = render(<List onMove={onMove} />);
  let t = touch('A');
  rerender(<List onMove={onMove} disabled />);
  t.move('C', 'end');
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  t.up('C', 'end');

  rerender(<List onMove={onMove} />);
  t = touch('A');
  t.move('C', 'end');
  expect(item('A').getAttribute('data-dragging')).toBe('');
  rerender(<List onMove={onMove} disabled />);
  t.up('C', 'end');
  expect(onMove).not.toHaveBeenCalled();
  expect(order()).toEqual(['A', 'B', 'C', 'D']);
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

// Two lists of one group, side by side: 'left' at x 0 and 'right' at x 300. Each keeps its own order,
// and the group moves items between them.
type Key = 'left' | 'right';

function Column({
  group,
  list,
  items,
  x,
  disabled,
  onMove,
  memoized,
}: {
  group: ReorderGroup<Key>;
  list: Key;
  items: string[];
  x: number;
  disabled?: boolean;
  onMove: (from: number, to: number) => void;
  memoized?: boolean;
}) {
  const reorder = useReorder({ group, list, disabled, onMove });
  return (
    <ul data-x={x} data-testid={`list-${list}`} {...reorder.getListProps()}>
      {items.map((name, index) =>
        memoized ? (
          <Row key={name} {...reorder.getItemProps(index)} name={name} grip={reorder.getHandleProps(index)} />
        ) : (
          <li key={name} {...reorder.getItemProps(index)}>
            <span data-testid={`handle-${name}`} {...reorder.getHandleProps(index)}>
              ::
            </span>
            <span>{name}</span>
          </li>
        ),
      )}
    </ul>
  );
}

function Board({
  right: initialRight = ['W', 'X'],
  onBetween,
  onWithin,
  rightDisabled,
  hideLeft,
  memoized,
}: {
  right?: string[];
  hideLeft?: boolean;
  memoized?: boolean;
  onBetween?: (from: ReorderPlace<Key>, to: ReorderPlace<Key>) => void;
  onWithin?: (list: Key, from: number, to: number) => void;
  rightDisabled?: boolean;
}) {
  const [lists, setLists] = useState<Record<Key, string[]>>({ left: ['A', 'B', 'C', 'D'], right: initialRight });
  const move = (from: ReorderPlace<Key>, to: ReorderPlace<Key>) =>
    setLists((current) => {
      const next = { left: [...current.left], right: [...current.right] };
      const [moved] = next[from.list].splice(from.index, 1);
      next[to.list].splice(to.index, 0, moved!);
      return next;
    });
  const group = useReorderGroup<Key>({
    onMove: (from, to) => {
      onBetween?.(from, to);
      move(from, to);
    },
  });
  const within = (list: Key) => (from: number, to: number) => {
    onWithin?.(list, from, to);
    move({ list, index: from }, { list, index: to });
  };
  return (
    <>
      {!hideLeft && <Column group={group} list="left" items={lists.left} x={0} onMove={within('left')} memoized={memoized} />}
      <Column
        group={group}
        list="right"
        items={lists.right}
        x={300}
        disabled={rightDisabled}
        onMove={within('right')}
        memoized={memoized}
      />
    </>
  );
}

const orderIn = (list: Key) =>
  [...screen.getByTestId(`list-${list}`).querySelectorAll('li')].map((node) => node.textContent!.replace('::', ''));
/** A point in a list, below its items. */
const below = (list: Key) => ({ clientX: leftOf(screen.getByTestId(`list-${list}`)) + 5, clientY: 390 });

it('moves an item dragged to another list of its group, and shows the line only in the list under the pointer', () => {
  const onBetween = vi.fn();
  const onWithin = vi.fn();
  render(<Board onBetween={onBetween} onWithin={onWithin} />);
  const d = mouseDrag('B');
  d.over('C', 'end');
  expect(item('C').getAttribute('data-drop')).toBe('after');
  const over = d.over('W', 'end');
  expect(over.defaultPrevented).toBe(true);
  expect(item('W').getAttribute('data-drop')).toBe('after');
  expect(item('C').getAttribute('data-drop')).toBeNull();
  expect(screen.getByTestId('list-right').getAttribute('data-drop-target')).toBe('');
  expect(screen.getByTestId('list-left').getAttribute('data-drop-target')).toBeNull();
  // Before the first item of another list is a move too, unlike before the item next to it in its own.
  d.over('W', 'start');
  expect(item('W').getAttribute('data-drop')).toBe('before');
  d.drop('W', 'end');
  expect(onBetween).toHaveBeenCalledExactlyOnceWith({ list: 'left', index: 1 }, { list: 'right', index: 1 });
  expect(onWithin).not.toHaveBeenCalled();
  expect(orderIn('left')).toEqual(['A', 'C', 'D']);
  expect(orderIn('right')).toEqual(['W', 'B', 'X']);
  for (const node of screen.getAllByRole('listitem')) {
    expect(node.getAttribute('data-dragging')).toBeNull();
    expect(node.getAttribute('data-drop')).toBeNull();
  }
  expect(screen.getByTestId('list-right').getAttribute('data-drop-target')).toBeNull();
});

it('keeps a drop inside one list of a group with that list\'s own onMove', () => {
  const onBetween = vi.fn();
  const onWithin = vi.fn();
  render(<Board onBetween={onBetween} onWithin={onWithin} />);
  const d = mouseDrag('W');
  d.drop('X', 'end');
  expect(onWithin).toHaveBeenCalledExactlyOnceWith('right', 0, 1);
  expect(onBetween).not.toHaveBeenCalled();
  expect(orderIn('right')).toEqual(['X', 'W']);
});

it('drops past the last item, or in an empty list, at the end of the list', () => {
  const onBetween = vi.fn();
  render(<Board right={[]} onBetween={onBetween} />);
  const right = screen.getByTestId('list-right');
  const d = mouseDrag('A');
  d.over('B', 'end');
  expect(item('B').getAttribute('data-drop')).toBe('after');
  const over = d.on(right, 'dragover', below('right'));
  expect(over.defaultPrevented).toBe(true);
  expect(right.getAttribute('data-drop-target')).toBe('');
  expect(item('B').getAttribute('data-drop')).toBeNull();
  d.on(right, 'drop', below('right'));
  expect(onBetween).toHaveBeenCalledExactlyOnceWith({ list: 'left', index: 0 }, { list: 'right', index: 0 });
  expect(orderIn('right')).toEqual(['A']);
  expect(right.getAttribute('data-drop-target')).toBeNull();

  const again = mouseDrag('B');
  again.on(right, 'dragover', below('right'));
  expect(item('A').getAttribute('data-drop')).toBe('after');
  // Leaving the list clears its line.
  again.on(right, 'dragleave', { clientX: 900, clientY: 900 });
  expect(item('A').getAttribute('data-drop')).toBeNull();
  expect(right.getAttribute('data-drop-target')).toBeNull();
  again.end();
});

it('takes nothing into a disabled list of the group', () => {
  const onBetween = vi.fn();
  render(<Board onBetween={onBetween} rightDisabled />);
  const d = mouseDrag('A');
  const over = d.over('W', 'end');
  expect(over.defaultPrevented).toBe(false);
  expect(item('W').getAttribute('data-drop')).toBeNull();
  d.drop('W', 'end');
  expect(onBetween).not.toHaveBeenCalled();
  expect(item('A').getAttribute('data-dragging')).toBeNull();
});

it('moves an item a finger drags to another list of its group, onto an item or below them', () => {
  const onBetween = vi.fn();
  render(<Board onBetween={onBetween} />);
  const t = touch('D');
  t.move('B', 'start');
  expect(item('B').getAttribute('data-drop')).toBe('before');
  t.move('X', 'start');
  expect(item('B').getAttribute('data-drop')).toBeNull();
  expect(item('X').getAttribute('data-drop')).toBe('before');
  t.up('X', 'start');
  expect(onBetween).toHaveBeenLastCalledWith({ list: 'left', index: 3 }, { list: 'right', index: 1 });
  expect(orderIn('right')).toEqual(['W', 'D', 'X']);

  touch('A');
  act(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, pointerType: 'touch', ...below('right') }));
  });
  expect(item('X').getAttribute('data-drop')).toBe('after');
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', ...below('right') }));
  });
  expect(onBetween).toHaveBeenLastCalledWith({ list: 'left', index: 0 }, { list: 'right', index: 3 });
  expect(orderIn('left')).toEqual(['B', 'C']);
  expect(orderIn('right')).toEqual(['W', 'D', 'X', 'A']);
});

it('clears the line in another list when the list a touch drag started from goes away', () => {
  const onBetween = vi.fn();
  const { rerender } = render(<Board onBetween={onBetween} />);
  const t = touch('A');
  t.move('W', 'end');
  expect(item('W').getAttribute('data-drop')).toBe('after');
  rerender(<Board onBetween={onBetween} hideLeft />);
  expect(item('W').getAttribute('data-drop')).toBeNull();
  expect(screen.getByTestId('list-right').getAttribute('data-drop-target')).toBeNull();
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch', ...point('W', 'end') }));
  });
  expect(onBetween).not.toHaveBeenCalled();
});

it('clears the line in another list when a touch drag is cancelled', () => {
  const onBetween = vi.fn();
  render(<Board onBetween={onBetween} />);
  const t = touch('A');
  t.move('W', 'end');
  expect(item('W').getAttribute('data-drop')).toBe('after');
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  expect(item('W').getAttribute('data-drop')).toBeNull();
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  t.up('W', 'end');
  expect(onBetween).not.toHaveBeenCalled();
});

// Nested lists of one group, laid out by data-r="left,top,width,height" on each element.
function nestedLayout() {
  const box = (node: Element) => {
    const [x = 0, y = 0, w = 0, h = 0] = (node.getAttribute('data-r') ?? '').split(',').map(Number);
    return new DOMRect(x, y, w, h);
  };
  vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
    return box(this);
  });
  (document as { elementFromPoint: Document['elementFromPoint'] }).elementFromPoint = (x, y) =>
    [...document.querySelectorAll('[data-r]')].reverse().find((node) => {
      const b = box(node);
      return x >= b.left && x < b.right && y >= b.top && y < b.bottom;
    }) ?? null;
}

/** An outer list of O1 and O2, with an inner list of the same group inside O2, or inside O1 with `inO1`. */
function Nested({
  onOuter,
  onBetween,
  innerDisabled,
  inO1,
}: {
  onOuter: (from: number, to: number) => void;
  onBetween: (from: ReorderPlace<string>, to: ReorderPlace<string>) => void;
  innerDisabled?: boolean;
  inO1?: boolean;
}) {
  const group = useReorderGroup<string>({ onMove: onBetween });
  const outer = useReorder({ group, list: 'outer', onMove: onOuter });
  const inner = useReorder({ group, list: 'inner', disabled: innerDisabled, onMove: () => {} });
  const innerList = (top: number) => (
    <ul data-r={`0,${top},200,40`} {...inner.getListProps()}>
      <li data-r={`0,${top},200,40`} {...inner.getItemProps(0)}>
        I1
      </li>
    </ul>
  );
  return (
    <ul data-r="0,0,200,400" {...outer.getListProps()}>
      <li data-r={inO1 ? '0,0,200,140' : '0,0,200,40'} {...outer.getItemProps(0)}>
        <span data-testid="handle-O1" {...outer.getHandleProps(0)}>
          ::
        </span>
        O1
        {inO1 && innerList(100)}
      </li>
      <li data-r={inO1 ? '0,140,200,100' : '0,40,200,100'} {...outer.getItemProps(1)}>
        O2
        {!inO1 && innerList(100)}
      </li>
    </ul>
  );
}

const outerItem = (name: RegExp) => screen.getByText(name, { selector: 'li' });

it('leaves a drop on a disabled list nested in an item to the list around it, by mouse and by finger', () => {
  nestedLayout();
  const onOuter = vi.fn();
  const onBetween = vi.fn();
  render(<Nested onOuter={onOuter} onBetween={onBetween} innerDisabled />);
  const at = { clientX: 5, clientY: 110 };
  const d = mouseDrag('O1');
  d.on(screen.getByText('I1'), 'dragover', at);
  expect(outerItem(/O2/).getAttribute('data-drop')).toBe('after');
  d.on(screen.getByText('I1'), 'drop', at);
  d.end();
  expect(onOuter).toHaveBeenCalledExactlyOnceWith(0, 1);

  onOuter.mockClear();
  const fire = (type: string, x: number, y: number) =>
    act(() => {
      const target = type === 'pointerdown' ? screen.getByTestId('handle-O1') : window;
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y }));
    });
  fire('pointerdown', 5, 5);
  fire('pointermove', at.clientX, at.clientY);
  expect(outerItem(/O2/).getAttribute('data-drop')).toBe('after');
  fire('pointerup', at.clientX, at.clientY);
  expect(onOuter).toHaveBeenCalledExactlyOnceWith(0, 1);
  expect(onBetween).not.toHaveBeenCalled();
});

it('moves nothing when an item is dropped on a list inside itself', () => {
  nestedLayout();
  const onOuter = vi.fn();
  const onBetween = vi.fn();
  render(<Nested onOuter={onOuter} onBetween={onBetween} inO1 />);
  const at = { clientX: 5, clientY: 110 };
  const d = mouseDrag('O1');
  const over = d.on(screen.getByText('I1'), 'dragover', at);
  expect(over.defaultPrevented).toBe(true);
  expect(screen.getByText('I1').getAttribute('data-drop')).toBeNull();
  d.on(screen.getByText('I1'), 'drop', at);
  d.end();

  const fire = (type: string, x: number, y: number) =>
    act(() => {
      const target = type === 'pointerdown' ? screen.getByTestId('handle-O1') : window;
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y }));
    });
  fire('pointerdown', 5, 5);
  fire('pointermove', at.clientX, at.clientY);
  expect(screen.getByText('I1').getAttribute('data-drop')).toBeNull();
  fire('pointerup', at.clientX, at.clientY);
  expect(onBetween).not.toHaveBeenCalled();
  expect(onOuter).not.toHaveBeenCalled();
});

// A long list memoizes its rows, so a drag step costs the rows whose own state changed: at most the
// one it leaves and the one it reaches.
it('renders only the memoized rows whose own drag state changes, at each step of a mouse drag', () => {
  render(<List memoized />);
  rendered();
  fireEvent.pointerDown(screen.getByTestId('handle-A'), { button: 0, pointerType: 'mouse' });
  expect(item('A').getAttribute('draggable')).toBe('true');
  expect(rendered()).toEqual(['A']);
  const dataTransfer = stubDataTransfer();
  fireDrag(item('A'), 'dragstart', dataTransfer);
  expect(item('A').getAttribute('data-dragging')).toBe('');
  expect(rendered()).toEqual(['A']);
  fireDrag(item('C'), 'dragover', dataTransfer, point('C', 'end'));
  expect(item('C').getAttribute('data-drop')).toBe('after');
  expect(rendered()).toEqual(['C']);
  fireDrag(item('C'), 'dragover', dataTransfer, point('C', 'end'));
  expect(rendered()).toEqual([]);
  fireDrag(item('D'), 'dragover', dataTransfer, point('D', 'end'));
  expect(rendered()).toEqual(['C', 'D']);
  fireDrag(item('A'), 'dragend', dataTransfer);
  expect(item('A').getAttribute('data-dragging')).toBeNull();
  expect(item('D').getAttribute('data-drop')).toBeNull();
  expect(rendered().sort()).toEqual(['A', 'D']);
});

it('renders only the memoized rows whose own drag state changes, at each step of a finger drag', () => {
  const onMove = vi.fn();
  render(<List memoized onMove={onMove} />);
  rendered();
  const t = touch('B');
  expect(rendered()).toEqual([]);
  t.move('C', 'end');
  expect(item('B').getAttribute('data-dragging')).toBe('');
  expect(item('C').getAttribute('data-drop')).toBe('after');
  expect(rendered().sort()).toEqual(['B', 'C']);
  t.move('D', 'end');
  expect(rendered()).toEqual(['C', 'D']);
  t.up('D', 'end');
  expect(onMove).toHaveBeenCalledExactlyOnceWith(1, 3);
  expect(order()).toEqual(['A', 'C', 'D', 'B']);
});

it('renders only the memoized rows whose line moves when a drag crosses to another list of its group', () => {
  render(<Board memoized />);
  rendered();
  const d = mouseDrag('B');
  // Once for the press and once for dragstart.
  expect(rendered()).toEqual(['B', 'B']);
  d.over('C', 'end');
  expect(rendered()).toEqual(['C']);
  d.over('W', 'end');
  expect(item('W').getAttribute('data-drop')).toBe('after');
  expect(item('C').getAttribute('data-drop')).toBeNull();
  expect(rendered().sort()).toEqual(['C', 'W']);
  d.drop('W', 'end');
  expect(orderIn('right')).toEqual(['W', 'B', 'X']);
});
