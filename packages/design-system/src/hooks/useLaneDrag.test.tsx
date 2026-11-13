import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { memo, useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLaneDrag, useLaneDragState, type LaneDragChange, type LanePlace, type LaneVerdict, type UseLaneDragOptions } from './useLaneDrag.js';

// jsdom has no layout. Each part carries its box as data-r="x,y,width,height": two lanes 1000px
// wide and 40px tall, so the range 0 to 100 is 10px a unit, with the queue below them. The
// innermost element whose box holds a point is the one under it.

type Talk = { id: string; at: LanePlace | null; span: number };

const START: Talk[] = [
  { id: 't1', at: { lane: 'a', start: 10, end: 30 }, span: 20 },
  { id: 't2', at: { lane: 'b', start: 50, end: 60 }, span: 10 },
  { id: 'q1', at: null, span: 15 },
];

const LANES = ['a', 'b'];
const GRID = Array.from({ length: 21 }, (_, i) => i * 5);

let renders: Record<string, number> = {};
const count = (key: string) => {
  renders[key] = (renders[key] ?? 0) + 1;
};

const Ghost = memo(function Ghost({ drag, lane }: { drag: ReturnType<typeof useLaneDrag>['drag']; lane: string }) {
  const to = useLaneDragState(drag, (state) => (state?.to?.lane === lane ? state.to : null));
  count(`lane-${lane}`);
  return to ? <span data-testid={`ghost-${lane}`}>{`${to.start}-${to.end}`}</span> : null;
});

function Board({
  onDrop,
  check,
  disabled,
  axis,
  dir,
  minSpan,
  grid = GRID,
}: {
  onDrop?: (change: LaneDragChange) => void;
  check?: UseLaneDragOptions['check'];
  disabled?: boolean;
  axis?: 'inline' | 'block';
  dir?: 'rtl';
  minSpan?: number;
  grid?: readonly number[] | undefined;
}) {
  const [talks, setTalks] = useState(START);
  const lanes = useLaneDrag({
    range: { start: 0, end: 100 },
    grid,
    axis,
    minSpan,
    check,
    disabled,
    onDrop: (change) => {
      onDrop?.(change);
      setTalks((list) => list.map((talk) => (talk.id === change.id ? { ...talk, at: change.to } : talk)));
    },
  });
  count('board');
  const box = (lane: string) => (axis === 'block' ? `${LANES.indexOf(lane) * 100},0,100,1000` : `0,${LANES.indexOf(lane) * 40},1000,40`);
  const itemBox = (at: LanePlace) =>
    axis === 'block'
      ? `${LANES.indexOf(at.lane) * 100},${at.start * 10},100,${(at.end - at.start) * 10}`
      : `${dir === 'rtl' ? 1000 - at.end * 10 : at.start * 10},${LANES.indexOf(at.lane) * 40},${(at.end - at.start) * 10},40`;
  return (
    <div {...lanes.getBoardProps({ 'data-testid': 'board' })} data-r="0,0,1000,1000">
      {LANES.map((lane) => (
        <div key={lane} {...lanes.getLaneProps(lane, { 'data-testid': `lane-${lane}` })} data-r={box(lane)} style={dir ? { direction: dir } : undefined}>
          {talks
            .filter((talk) => talk.at?.lane === lane)
            .map((talk) => (
              <div key={talk.id} {...lanes.getItemProps(talk.id, talk.at!, { 'data-testid': talk.id })} data-r={itemBox(talk.at!)}>
                <span {...lanes.getHandleProps(talk.id, 'start')} data-testid={`${talk.id}-start`} />
                <span {...lanes.getHandleProps(talk.id, 'move')} data-testid={`${talk.id}-move`}>
                  <button type="button" data-testid={`${talk.id}-button`} onClick={() => count(`click-${talk.id}`)}>
                    {talk.id}
                  </button>
                </span>
                <span {...lanes.getHandleProps(talk.id, 'end')} data-testid={`${talk.id}-end`} />
              </div>
            ))}
          <Ghost drag={lanes.drag} lane={lane} />
        </div>
      ))}
      <ul {...lanes.getQueueProps({ 'data-testid': 'queue' })} data-r="0,100,1000,100">
        {talks
          .filter((talk) => talk.at === null)
          .map((talk) => (
            <li key={talk.id} {...lanes.getItemProps(talk.id, { span: talk.span }, { 'data-testid': talk.id })} data-r="0,120,200,40">
              <span {...lanes.getHandleProps(talk.id, 'move')} data-testid={`${talk.id}-move`} onClick={() => count(`click-${talk.id}`)} />
            </li>
          ))}
      </ul>
    </div>
  );
}

const rectOf = (node: Element) => {
  const [x = 0, y = 0, width = 0, height = 0] = (node.closest('[data-r]')?.getAttribute('data-r') ?? '').split(',').map(Number);
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect;
};

const doc = document as Omit<Document, 'elementFromPoint'> & { elementFromPoint?: Document['elementFromPoint'] };
let previous: Document['elementFromPoint'] | undefined;

beforeEach(() => {
  renders = {};
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectOf(this);
  });
  previous = doc.elementFromPoint;
  doc.elementFromPoint = (x: number, y: number) => {
    let hit: Element | null = null;
    for (const node of document.querySelectorAll('[data-r]')) {
      const r = rectOf(node);
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) hit = node;
    }
    return hit;
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (previous) doc.elementFromPoint = previous;
  else delete doc.elementFromPoint;
});

/** Presses `handle` at x, y, moves through `path` and releases at the last point. */
function drag(handle: Element, x: number, y: number, path: [number, number][], type = 'mouse') {
  const at = (px: number, py: number) => ({ clientX: px, clientY: py, pointerId: 1, pointerType: type, isPrimary: true, button: 0 });
  fireEvent.pointerDown(handle, at(x, y));
  for (const [px, py] of path) act(() => void window.dispatchEvent(new PointerEvent('pointermove', at(px, py))));
  const [ux, uy] = path.at(-1) ?? [x, y];
  act(() => void window.dispatchEvent(new PointerEvent('pointerup', at(ux, uy))));
}

function press(handle: Element, x: number, y: number) {
  fireEvent.pointerDown(handle, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 });
}

function move(x: number, y: number) {
  act(() => void window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' })));
}

function release(x: number, y: number) {
  act(() => void window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' })));
}

it('moves an item along its lane, keeping the point it was grabbed at, snapped to the grid', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  // t1 spans 10 to 30; grabbed 5 units in, at 15, and dropped at 41, its start goes to 36 and snaps to 35.
  drag(screen.getByTestId('t1-move'), 150, 20, [[200, 20], [410, 20]]);
  expect(onDrop).toHaveBeenCalledWith({
    id: 't1',
    kind: 'move',
    from: { lane: 'a', start: 10, end: 30 },
    to: { lane: 'a', start: 35, end: 55 },
    verdict: null,
  });
  expect(screen.getByTestId('t1').getAttribute('data-todae-lane-start')).toBe('35');
});

it('moves an item to the lane under the pointer', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  drag(screen.getByTestId('t1-move'), 150, 20, [[150, 50], [150, 60]]);
  expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ kind: 'move', to: { lane: 'b', start: 10, end: 30 } }));
  expect(screen.getByTestId('lane-b').contains(screen.getByTestId('t1'))).toBe(true);
});

it('places an item from the queue with its start at the pointer and its own span', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  drag(screen.getByTestId('q1-move'), 20, 130, [[20, 100], [702, 60]]);
  expect(onDrop).toHaveBeenCalledWith({ id: 'q1', kind: 'assign', from: null, to: { lane: 'b', start: 70, end: 85 }, verdict: null });
});

it('keeps a move inside the range', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  drag(screen.getByTestId('t1-move'), 150, 20, [[900, 20], [999, 20]]);
  expect(onDrop).toHaveBeenLastCalledWith(expect.objectContaining({ to: { lane: 'a', start: 80, end: 100 } }));
  drag(screen.getByTestId('t1-move'), 850, 20, [[400, 20], [0, 20]]);
  expect(onDrop).toHaveBeenLastCalledWith(expect.objectContaining({ to: { lane: 'a', start: 0, end: 20 } }));
});

it('snaps a move near the range\'s end to the last grid point that fits, not to the clamped start', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} grid={[0, 30, 60, 90]} />);
  // t1's span of 20 can start no later than 80, which isn't a grid point, so it starts at 60.
  drag(screen.getByTestId('t1-move'), 150, 20, [[900, 20], [999, 20]]);
  expect(onDrop).toHaveBeenLastCalledWith(expect.objectContaining({ to: { lane: 'a', start: 60, end: 80 } }));
});

it('finds no place for an item longer than the range', () => {
  const onDrop = vi.fn();
  function Host() {
    const lanes = useLaneDrag({ range: { start: 0, end: 100 }, grid: GRID, onDrop });
    return (
      <div {...lanes.getBoardProps()} data-r="0,0,1000,1000">
        <div {...lanes.getLaneProps('a')} data-r="0,0,1000,40">
          <Ghost drag={lanes.drag} lane="a" />
        </div>
        <div {...lanes.getQueueProps()} data-r="0,100,1000,100">
          <div {...lanes.getItemProps('long', { span: 150 })} data-r="0,120,200,40">
            <span {...lanes.getHandleProps('long', 'move')} data-testid="long" />
          </div>
        </div>
      </div>
    );
  }
  render(<Host />);
  press(screen.getByTestId('long'), 20, 130);
  move(100, 20);
  expect(screen.queryByTestId('ghost-a')).toBeNull();
  release(100, 20);
  expect(onDrop).not.toHaveBeenCalled();
});

it('takes a placed item back to the queue', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  drag(screen.getByTestId('t2-move'), 550, 60, [[550, 90], [500, 150]]);
  expect(onDrop).toHaveBeenCalledWith({ id: 't2', kind: 'unassign', from: { lane: 'b', start: 50, end: 60 }, to: null, verdict: null });
  expect(screen.getByTestId('queue').contains(screen.getByTestId('t2'))).toBe(true);
});

it('drops nothing outside the lanes and the queue, nor where the item already is, nor a queue item on the queue', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  drag(screen.getByTestId('t1-move'), 150, 20, [[150, 300], [150, 900]]);
  drag(screen.getByTestId('t1-move'), 150, 20, [[200, 20], [150, 20]]);
  drag(screen.getByTestId('q1-move'), 20, 130, [[60, 130], [100, 150]]);
  expect(onDrop).not.toHaveBeenCalled();
});

it('resizes either end along the item\'s lane, snapped, within the range and minSpan', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} minSpan={10} />);
  drag(screen.getByTestId('t1-end'), 300, 20, [[350, 20], [462, 60]]);
  expect(onDrop).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'resize-end', to: { lane: 'a', start: 10, end: 45 } }));
  // Past the start, the end stops minSpan after it.
  drag(screen.getByTestId('t1-end'), 450, 20, [[300, 20], [0, 20]]);
  expect(onDrop).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'resize-end', to: { lane: 'a', start: 10, end: 20 } }));
  drag(screen.getByTestId('t1-start'), 100, 20, [[60, 20], [-500, 20]]);
  expect(onDrop).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'resize-start', to: { lane: 'a', start: 0, end: 20 } }));
  drag(screen.getByTestId('t1-start'), 0, 20, [[100, 20], [900, 20]]);
  expect(onDrop).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'resize-start', to: { lane: 'a', start: 10, end: 20 } }));
});

it('never leaves a resized item without length, even with no grid and no minSpan', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} grid={[]} />);
  drag(screen.getByTestId('t1-end'), 300, 20, [[250, 20], [123, 20], [50, 20]]);
  expect(onDrop).toHaveBeenLastCalledWith(expect.objectContaining({ to: { lane: 'a', start: 10, end: 12.3 } }));
});

it('asks check each time the place changes, and refuses a blocked drop while a warning drops', () => {
  const onDrop = vi.fn();
  const check = vi.fn((id: string, to: LanePlace): LaneVerdict | null =>
    to.lane === 'b' && to.start < 60 && to.end > 50
      ? { level: to.start < 45 ? 'blocked' : 'warning', reason: 'Overlaps t2', with: ['t2'] }
      : null,
  );
  render(<Board onDrop={onDrop} check={check} />);
  press(screen.getByTestId('t1-move'), 150, 20);
  move(200, 20);
  move(201, 20);
  // Two moves inside one snapped place ask once.
  expect(check).toHaveBeenCalledTimes(1);
  move(400, 60);
  expect(screen.getByTestId('lane-b').getAttribute('data-conflict')).toBe('blocked');
  expect(screen.getByTestId('t2').getAttribute('data-conflict')).toBe('blocked');
  expect(screen.getByTestId('lane-b').hasAttribute('data-drop-target')).toBe(true);
  expect(screen.getByTestId('lane-a').hasAttribute('data-drop-target')).toBe(false);
  release(400, 60);
  expect(onDrop).not.toHaveBeenCalled();
  expect(screen.getByTestId('t2').hasAttribute('data-conflict')).toBe(false);
  expect(screen.getByTestId('lane-b').hasAttribute('data-conflict')).toBe(false);

  drag(screen.getByTestId('t1-move'), 150, 20, [[200, 20], [500, 60]]);
  expect(onDrop).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'move', to: { lane: 'b', start: 45, end: 65 }, verdict: { level: 'warning', reason: 'Overlaps t2', with: ['t2'] } }),
  );
});

it('never marks the dragged item as a conflict, even when check names it', () => {
  render(<Board check={() => ({ level: 'warning', reason: 'Busy', with: ['t1', 't2'] })} />);
  press(screen.getByTestId('t1-move'), 150, 20);
  move(200, 20);
  move(500, 60);
  expect(screen.getByTestId('t2').getAttribute('data-conflict')).toBe('warning');
  expect(screen.getByTestId('t1').hasAttribute('data-conflict')).toBe(false);
  release(500, 60);
});

it('listens on the window only while a press is down', () => {
  const add = vi.spyOn(window, 'addEventListener');
  const remove = vi.spyOn(window, 'removeEventListener');
  const moves = (spy: typeof add) => spy.mock.calls.filter(([type]) => type === 'pointermove').length;
  render(<Board />);
  expect(moves(add)).toBe(0);
  press(screen.getByTestId('t1-move'), 150, 20);
  expect(moves(add)).toBe(1);
  move(200, 20);
  release(200, 20);
  expect(moves(remove)).toBe(1);
});

it('stops the browser\'s own drag of an image or link inside a handle', () => {
  render(<Board />);
  // fireEvent returns false when the event's default was prevented.
  expect(fireEvent.dragStart(screen.getByTestId('t1-move'))).toBe(false);
});

it('marks the dragged item, the board and the drop target during a drag, and clears them after', () => {
  render(<Board />);
  press(screen.getByTestId('t1-move'), 150, 20);
  move(200, 20);
  expect(screen.getByTestId('t1').hasAttribute('data-dragging')).toBe(true);
  expect(screen.getByTestId('board').hasAttribute('data-dragging')).toBe(true);
  move(500, 150);
  expect(screen.getByTestId('queue').hasAttribute('data-drop-target')).toBe(true);
  expect(screen.getByTestId('lane-a').hasAttribute('data-drop-target')).toBe(false);
  release(150, 900);
  for (const node of document.querySelectorAll('*')) {
    expect(node.hasAttribute('data-dragging') || node.hasAttribute('data-drop-target') || node.hasAttribute('data-conflict')).toBe(false);
  }
});

it('starts no drag for a press that never moves past a small slop, and lets its click through', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  const handle = screen.getByTestId('q1-move');
  press(handle, 20, 130);
  move(23, 130);
  expect(screen.getByTestId('q1').hasAttribute('data-dragging')).toBe(false);
  release(23, 130);
  fireEvent.click(handle, { detail: 1 });
  expect(renders['click-q1']).toBe(1);
  expect(onDrop).not.toHaveBeenCalled();
});

it('drops the click a drag\'s release sends, but not a later press\'s', () => {
  render(<Board />);
  const handle = screen.getByTestId('q1-move');
  drag(handle, 20, 130, [[60, 130], [80, 150]]);
  fireEvent.click(handle, { detail: 1 });
  expect(renders['click-q1']).toBeUndefined();
  fireEvent.pointerDown(document.body, { button: 0 });
  fireEvent.click(handle, { detail: 1 });
  expect(renders['click-q1']).toBe(1);
});

it('leaves a press on a control inside the handle to that control', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  drag(screen.getByTestId('t1-button'), 150, 20, [[200, 20], [400, 20]]);
  expect(onDrop).not.toHaveBeenCalled();
});

it('cancels a drag on Escape and drops its release\'s click', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  const handle = screen.getByTestId('q1-move');
  press(handle, 20, 130);
  move(60, 130);
  move(400, 20);
  expect(screen.getByTestId('ghost-a').textContent).toBe('40-55');
  act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(screen.queryByTestId('ghost-a')).toBeNull();
  expect(screen.getByTestId('q1').hasAttribute('data-dragging')).toBe(false);
  move(500, 20);
  expect(screen.queryByTestId('ghost-a')).toBeNull();
  release(500, 20);
  fireEvent.click(handle, { detail: 1 });
  expect(onDrop).not.toHaveBeenCalled();
  expect(renders['click-q1']).toBeUndefined();
});

it('ends a drag without a drop on pointercancel', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  press(screen.getByTestId('t1-move'), 150, 20);
  move(400, 20);
  act(() => void window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
  release(400, 20);
  expect(onDrop).not.toHaveBeenCalled();
  expect(screen.getByTestId('t1').hasAttribute('data-dragging')).toBe(false);
});

it('starts no drag when disabled, and refuses the drop of one under way', () => {
  const onDrop = vi.fn();
  const { rerender } = render(<Board onDrop={onDrop} disabled />);
  drag(screen.getByTestId('t1-move'), 150, 20, [[200, 20], [400, 20]]);
  expect(screen.getByTestId('t1').hasAttribute('data-dragging')).toBe(false);
  rerender(<Board onDrop={onDrop} />);
  press(screen.getByTestId('t1-move'), 150, 20);
  move(400, 20);
  rerender(<Board onDrop={onDrop} disabled />);
  release(400, 20);
  expect(onDrop).not.toHaveBeenCalled();
});

it('ends a drag whose item goes away', () => {
  const onDrop = vi.fn();
  function Host() {
    const [shown, setShown] = useState(true);
    return (
      <>
        <button type="button" onClick={() => setShown(false)}>
          hide
        </button>
        {shown ? <Board onDrop={onDrop} /> : null}
      </>
    );
  }
  render(<Host />);
  press(screen.getByTestId('t1-move'), 150, 20);
  move(400, 20);
  fireEvent.click(screen.getByText('hide'), { detail: 0 });
  release(400, 20);
  expect(onDrop).not.toHaveBeenCalled();
});

it('renders the board only as a drag starts and ends, and a lane only when the place in it changes', () => {
  render(<Board />);
  renders = {};
  press(screen.getByTestId('t1-move'), 150, 20);
  for (let x = 160; x <= 500; x += 10) move(x, 20);
  expect(renders.board).toBe(1);
  // The ghost in lane a changes with each snapped place; lane b's selection stays null.
  expect(renders['lane-b']).toBeUndefined();
  const before = renders['lane-a'] ?? 0;
  move(500, 60);
  move(510, 60);
  move(520, 60);
  expect(renders['lane-a']).toBe(before + 1);
  release(520, 60);
  expect(renders.board).toBeLessThanOrEqual(3);
});

it('takes no drag from a press of another mouse button', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  fireEvent.pointerDown(screen.getByTestId('t1-move'), { clientX: 150, clientY: 20, pointerId: 1, pointerType: 'mouse', button: 2 });
  move(400, 20);
  release(400, 20);
  expect(onDrop).not.toHaveBeenCalled();
});

it('drags with a finger the same way', () => {
  const onDrop = vi.fn();
  render(<Board onDrop={onDrop} />);
  drag(screen.getByTestId('t1-move'), 150, 20, [[200, 20], [410, 20]], 'touch');
  expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ to: { lane: 'a', start: 35, end: 55 } }));
});

it('selects from the drag with useLaneDragState and a custom isEqual', () => {
  const seen: (number | null)[] = [];
  function Probe({ drag }: { drag: ReturnType<typeof useLaneDrag>['drag'] }) {
    const value = useLaneDragState(
      drag,
      (state) => ({ start: state?.to?.start ?? null }),
      (a, b) => a.start === b.start,
    );
    seen.push(value.start);
    return null;
  }
  function Host() {
    const lanes = useLaneDrag({ range: { start: 0, end: 100 }, grid: GRID, onDrop: () => {} });
    return (
      <div {...lanes.getBoardProps()} data-r="0,0,1000,1000">
        <div {...lanes.getLaneProps('a')} data-r="0,0,1000,40">
          <div {...lanes.getItemProps('x', { lane: 'a', start: 0, end: 10 })} data-r="0,0,100,40">
            <span {...lanes.getHandleProps('x', 'move')} data-testid="x" />
          </div>
        </div>
        <Probe drag={lanes.drag} />
      </div>
    );
  }
  render(<Host />);
  press(screen.getByTestId('x'), 50, 20);
  move(60, 20);
  const started = seen.length;
  // Each move builds a new selection, which isEqual finds the same.
  move(61, 20);
  move(62, 20);
  expect(seen.length).toBe(started);
  release(62, 20);
  expect(seen.filter((value, index) => index === 0 || value !== seen[index - 1])).toEqual([null, 0, null]);
});
