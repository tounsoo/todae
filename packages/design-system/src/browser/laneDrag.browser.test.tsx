import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { Dialog, useLaneDrag, useLaneDragState, type LaneDragChange, type LanePlace } from '../index.js';

afterEach(cleanup);

// Real layout: two lanes 600px long over the range 0 to 60, so 10px a unit, snapped to every 5.
// The pointer events are dispatched at real coordinates, so hit-testing, the text direction and
// the board's scrolling are the browser's own.

type Talk = { id: string; at: LanePlace };

function Preview({ drag, lane }: { drag: ReturnType<typeof useLaneDrag>['drag']; lane: string }) {
  const to = useLaneDragState(drag, (state) => (state?.to?.lane === lane ? state.to : null));
  return to ? <span data-testid={`preview-${lane}`}>{`${to.start}-${to.end}`}</span> : null;
}

function Board({
  onDrop,
  dir,
  axis,
  width = 600,
}: {
  onDrop?: (change: LaneDragChange) => void;
  dir?: 'rtl';
  axis?: 'block';
  width?: number;
}) {
  const [talks, setTalks] = useState<Talk[]>([{ id: 't1', at: { lane: 'a', start: 10, end: 20 } }]);
  const lanes = useLaneDrag({
    range: { start: 0, end: 60 },
    grid: Array.from({ length: 13 }, (_, i) => i * 5),
    axis,
    onDrop: (change) => {
      onDrop?.(change);
      setTalks((list) => list.map((talk) => (talk.id === change.id && change.to ? { ...talk, at: change.to } : talk)));
    },
  });
  const block = axis === 'block';
  return (
    <div
      {...lanes.getBoardProps({ 'data-testid': 'board' })}
      dir={dir}
      style={{ display: 'flex', flexDirection: block ? 'row' : 'column', inlineSize: width, overflow: 'auto', margin: 0 }}
    >
      {['a', 'b'].map((lane) => (
        <div
          key={lane}
          {...lanes.getLaneProps(lane, { 'data-testid': `lane-${lane}` })}
          style={{ position: 'relative', flex: 'none', inlineSize: block ? 100 : 600, blockSize: block ? 600 : 40 }}
        >
          {talks
            .filter((talk) => talk.at.lane === lane)
            .map((talk) => (
              <div
                key={talk.id}
                {...lanes.getItemProps(talk.id, talk.at)}
                data-testid={talk.id}
                style={
                  block
                    ? { position: 'absolute', insetInline: 0, insetBlockStart: talk.at.start * 10, blockSize: (talk.at.end - talk.at.start) * 10 }
                    : { position: 'absolute', insetBlock: 0, insetInlineStart: talk.at.start * 10, inlineSize: (talk.at.end - talk.at.start) * 10 }
                }
              >
                <span {...lanes.getHandleProps(talk.id, 'move')} data-testid={`${talk.id}-move`} style={{ display: 'block', inlineSize: '100%', blockSize: '100%', touchAction: 'none' }} />
              </div>
            ))}
          <Preview drag={lanes.drag} lane={lane} />
        </div>
      ))}
    </div>
  );
}

const pointer = (type: string, target: EventTarget, x: number, y: number) =>
  act(() => {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y }));
  });

/** The point `units` along the lane `lane`, in its middle across. */
function along(lane: string, units: number, axis: 'inline' | 'block' = 'inline') {
  const box = screen.getByTestId(`lane-${lane}`).getBoundingClientRect();
  const rtl = getComputedStyle(screen.getByTestId(`lane-${lane}`)).direction === 'rtl';
  if (axis === 'block') return { x: box.left + box.width / 2, y: box.top + units * 10 };
  return { x: rtl ? box.right - units * 10 : box.left + units * 10, y: box.top + box.height / 2 };
}

function dragFromTo(start: { x: number; y: number }, end: { x: number; y: number }) {
  const handle = screen.getByTestId('t1-move');
  pointer('pointerdown', handle, start.x, start.y);
  pointer('pointermove', handle, start.x + 6, start.y);
  pointer('pointermove', handle, end.x, end.y);
  pointer('pointerup', handle, end.x, end.y);
}

it('moves an item to the lane and place under the pointer, from the lanes\' real boxes', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  // Grabbed 2 units in, at 12, and dropped at 39 in lane b: the start goes to 37 and snaps to 35.
  dragFromTo(along('a', 12), along('b', 39));
  expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ kind: 'move', to: { lane: 'b', start: 35, end: 45 } }));
});

it('runs the inline axis from the right in a right-to-left board', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} dir="rtl" />);
  dragFromTo(along('a', 12), along('a', 32));
  expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ to: { lane: 'a', start: 30, end: 40 } }));
});

it('runs down each lane with axis block', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} axis="block" />);
  dragFromTo(along('a', 12, 'block'), along('b', 27, 'block'));
  expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ to: { lane: 'b', start: 25, end: 35 } }));
});

it('scrolls the board while the pointer stays near its edge, and moves the place with it', async () => {
  render(<Board width={300} />);
  const board = screen.getByTestId('board');
  const box = board.getBoundingClientRect();
  const handle = screen.getByTestId('t1-move');
  const start = along('a', 12);
  pointer('pointerdown', handle, start.x, start.y);
  pointer('pointermove', handle, start.x + 6, start.y);
  pointer('pointermove', handle, box.right - 4, start.y);
  const before = screen.getByTestId('preview-a').textContent;
  await vi.waitFor(() => expect(board.scrollLeft).toBeGreaterThan(40));
  await vi.waitFor(() => expect(screen.getByTestId('preview-a').textContent).not.toBe(before));
  pointer('pointerup', handle, box.right - 4, start.y);
  expect(screen.queryByTestId('preview-a')).toBeNull();
});

it('cancels a drag on Escape before a dialog around the board, which stays open', async () => {
  const onDrop = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Title>Schedule</Dialog.Title>
      <Board onDrop={onDrop} />
    </Dialog.Root>,
  );
  const start = along('a', 12);
  const handle = screen.getByTestId('t1-move');
  pointer('pointerdown', handle, start.x, start.y);
  pointer('pointermove', handle, start.x + 60, start.y);
  expect(screen.getByTestId('preview-a')).toBeTruthy();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByTestId('preview-a')).toBeNull();
  expect(onOpenChange).not.toHaveBeenCalled();
  pointer('pointerup', handle, start.x + 60, start.y);
  expect(onDrop).not.toHaveBeenCalled();
});
