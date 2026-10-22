import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type PointerEvent } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useReorder } from '../index.js';

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
