import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { Fragment, useState } from 'react';
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
  smooth = false,
  names = false,
  scale,
}: {
  onDrop?: (change: LaneDragChange) => void;
  dir?: 'rtl';
  axis?: 'block';
  width?: number;
  smooth?: boolean;
  /** Puts a sticky 100px name before each lane, which the board's scroll-padding marks, inside a 4px border. */
  names?: boolean;
  /** Draws the board at this scale with a transform, as a dialog's opening does. */
  scale?: number;
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
      style={{
        display: 'flex',
        flexDirection: block ? 'row' : 'column',
        inlineSize: width,
        overflow: 'auto',
        margin: 0,
        scrollBehavior: smooth ? 'smooth' : undefined,
        scrollPaddingInlineStart: names ? 100 : undefined,
        border: names ? '4px solid' : undefined,
        transform: scale ? `scale(${scale})` : undefined,
        transformOrigin: scale ? '0 0' : undefined,
      }}
    >
      {['a', 'b'].map((lane) => {
        const track = (
          <div
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
        );
        return names ? (
          <div key={lane} style={{ display: 'flex', inlineSize: 'max-content' }}>
            <span data-testid={`name-${lane}`} style={{ position: 'sticky', insetInlineStart: 0, zIndex: 1, flex: 'none', inlineSize: 100, background: 'white' }}>
              {lane}
            </span>
            {track}
          </div>
        ) : (
          <Fragment key={lane}>{track}</Fragment>
        );
      })}
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

it.each([false, true])('scrolls the board while the pointer stays near its edge, and moves the place with it (smooth scrolling %s)', async (smooth) => {
  render(<Board width={300} smooth={smooth} />);
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

it.each([
  [undefined, 1],
  ['rtl', 1],
  [undefined, 0.5],
] as const)('scrolls back past sticky names the scroll-padding marks, and drops at the start under them (%s, scale %d)', async (dir, scale) => {
  const onDrop = vi.fn();
  render(<Board width={300} names dir={dir} scale={scale === 1 ? undefined : scale} onDrop={onDrop} />);
  const board = screen.getByTestId('board');
  const sign = dir === 'rtl' ? -1 : 1;
  board.scrollLeft = sign * 120;
  const box = board.getBoundingClientRect();
  // A point `px` of the board's own from its inline start, in lane a, on screen.
  const at = (px: number) => ({ x: dir === 'rtl' ? box.right - px * scale : box.left + px * scale, y: along('a', 0).y });
  const name = screen.getByTestId('name-a').getBoundingClientRect();
  expect(name.width).toBeCloseTo(100 * scale, 1);
  // The names sit inside the border, where the scroll-padding counts from.
  expect(dir === 'rtl' ? box.right - name.right : name.left - box.left).toBeCloseTo(4 * scale, 0);
  // t1 spans 10 to 20. The lane starts 100px into the scrollport, so scrolled 120px the item shows from 80 to 180, partly under the name.
  const handle = screen.getByTestId('t1-move');
  const grab = at(150);
  pointer('pointerdown', handle, grab.x, grab.y);
  pointer('pointermove', handle, grab.x - sign * 6, grab.y);
  // Just past the name, inside the edge, the board scrolls toward the start.
  const near = at(120);
  pointer('pointermove', handle, near.x, near.y);
  await vi.waitFor(() => expect(Math.abs(board.scrollLeft)).toBeLessThan(110));
  // Over the name, the board scrolls the rest of the way and the place follows the first point in view.
  const over = at(50);
  pointer('pointermove', handle, over.x, over.y);
  // Wherever the scroll stands, the place shown starts in view, within one grid step of the name's edge.
  const shown = Number(screen.getByTestId('preview-a').textContent?.split('-')[0]) * 10;
  const scrolled = Math.abs(board.scrollLeft);
  expect(shown).toBeGreaterThanOrEqual(scrolled);
  expect(shown).toBeLessThanOrEqual(scrolled + 50);
  await vi.waitFor(() => expect(Math.abs(board.scrollLeft)).toBe(0));
  await vi.waitFor(() => expect(screen.getByTestId('preview-a').textContent).toBe('0-10'));
  pointer('pointerup', handle, over.x, over.y);
  expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ kind: 'move', to: { lane: 'a', start: 0, end: 10 } }));
});

it('leaves the board still while the pointer is outside it, such as over a queue beside it', async () => {
  render(<Board width={300} />);
  const board = screen.getByTestId('board');
  const box = board.getBoundingClientRect();
  const handle = screen.getByTestId('t1-move');
  const start = along('a', 12);
  pointer('pointerdown', handle, start.x, start.y);
  pointer('pointermove', handle, start.x + 6, start.y);
  pointer('pointermove', handle, box.right + 30, start.y);
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(board.scrollLeft).toBe(0);
  pointer('pointerup', handle, box.right + 30, start.y);
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
