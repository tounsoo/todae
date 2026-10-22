import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useReorder } from '../index.js';

afterEach(cleanup);

function List({ onMove }: { onMove?: (from: number, to: number) => void }) {
  const [items, setItems] = useState(['A', 'B', 'C', 'D']);
  const reorder = useReorder({
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
    <ul style={{ inlineSize: 200, padding: 0, margin: 0, listStyle: 'none' }}>
      {items.map((item, index) => (
        <li key={item} {...reorder.getItemProps(index)} style={{ blockSize: 40, display: 'flex' }}>
          <span data-testid={`handle-${item}`} {...reorder.getHandleProps(index)} style={{ inlineSize: 24 }}>
            ::
          </span>
          <span data-testid={`text-${item}`}>{item}</span>
        </li>
      ))}
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
