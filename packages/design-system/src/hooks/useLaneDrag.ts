import { useEffect, useId, useRef, useState, useSyncExternalStore, type DragEvent, type PointerEvent } from 'react';
import { capturePointer } from '../internal/pointerCapture.js';
import { pixels } from '../internal/cssLength.js';
import { composeHandlers } from '../internal/props.js';
import { useEscapeKey } from '../overlay/useEscapeKey.js';

/** A place on the board: a lane's key and a span along the lanes' axis, in the board's units. */
export type LanePlace = {
  lane: string;
  start: number;
  end: number;
};

/** What a drag does: place an item from the queue, move a placed one, resize one of its ends, or take it back to the queue. */
export type LaneDragKind = 'assign' | 'move' | 'resize-start' | 'resize-end' | 'unassign';

/** What `check` says about a place. A `blocked` place takes no drop; a `warning` one does. */
export type LaneVerdict = {
  level: 'warning' | 'blocked';
  /** Why, in words a person reads, such as for the preview or an announcement. */
  reason: string;
  /** The ids of other items the place conflicts with. Each one's element gets `data-conflict` during the drag. */
  with?: readonly string[];
};

/** A drag under way, or a drop: the item, what the drag does, where the item was and where it would go. */
export type LaneDragChange = {
  id: string;
  kind: LaneDragKind;
  /** The item's place when the drag started, or null for an item from the queue. */
  from: LanePlace | null;
  /** Where the item would go, or null over the queue, outside the lanes, or when the item can't fit in `range`. */
  to: LanePlace | null;
  /** What `check` said about `to`, or null. */
  verdict: LaneVerdict | null;
};

/** The drag under way, read with `useLaneDragState`. */
export type LaneDragStore = {
  get: () => LaneDragChange | null;
  subscribe: (listener: () => void) => () => void;
};

export type UseLaneDragOptions = {
  /** The span every lane's element covers along the axis, in the board's units, such as minutes from the first day's start. */
  range: { start: number; end: number };
  /** The direction the range runs in each lane. `inline` follows the text direction, and `block` runs down. Default `inline`. */
  axis?: 'inline' | 'block';
  /** The points a start or end snaps to, in ascending order. Without it, places don't snap. */
  grid?: readonly number[];
  /** The shortest span a resize leaves. Default 0. */
  minSpan?: number;
  /** Says whether the item `id` may go to `to`, each time the place under the pointer changes and again at the drop. */
  check?: (id: string, to: LanePlace) => LaneVerdict | null;
  /** Called on a drop that changes an item's place, with the change. */
  onDrop: (change: LaneDragChange) => void;
  /** Turn dragging off. While `disabled` is true, a drag under way can't be dropped. */
  disabled?: boolean;
};

export type UseLaneDragHandleUserProps = {
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
};

export type UseLaneDragHandleProps = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  /** Stops the browser's own drag of an image or link inside the handle, which would end the drag. */
  onDragStart: (event: DragEvent<HTMLElement>) => void;
};

type Attributes = Record<`data-${string}`, string | undefined>;

export type UseLaneDragResult = {
  /**
   * Props for the element around the lanes. It scrolls during a drag while the pointer is inside it, near its edges.
   * Give it a `scroll-padding` where something sticky covers its lanes, such as their names: the edge counts from
   * past that strip, and a pointer over the strip drops at the first place in view.
   */
  getBoardProps: <P extends object>(props?: P) => P & Attributes;
  /** Props for a lane's element, by its key. Its box covers `range` along the axis. */
  getLaneProps: <P extends object>(lane: string, props?: P) => P & Attributes;
  /** Props for the element that holds unplaced items, where a placed item can be dropped to take it off the board. */
  getQueueProps: <P extends object>(props?: P) => P & Attributes;
  /** Props for an item's element, by its id, with its place on the board, or the span it takes when it is placed from the queue. */
  getItemProps: <P extends object>(id: string, at: LanePlace | { span: number }, props?: P) => P & Attributes;
  /** Props for the element a drag starts from inside an item: `move` moves the item, and `start` and `end` resize that end. */
  getHandleProps: <P extends UseLaneDragHandleUserProps>(
    id: string,
    part: 'move' | 'start' | 'end',
    props?: P,
  ) => Omit<P, keyof UseLaneDragHandleProps> & UseLaneDragHandleProps;
  /** The drag under way, for `useLaneDragState`. */
  drag: LaneDragStore;
};

const PARTS = 'data-todae-lanes';
const BOARD = 'data-todae-lanes-board';
const QUEUE = 'data-todae-lanes-queue';
const LANE = 'data-todae-lane';
const ITEM = 'data-todae-lane-item';
const IN = 'data-todae-lane-in';
const START = 'data-todae-lane-start';
const END = 'data-todae-lane-end';
const SPAN = 'data-todae-lane-span';
// How far a pointer moves on a handle before its item drags, so a click or a tap doesn't flash a drag.
const SLOP = 4;
// How close to an edge of the board the pointer comes before the board scrolls, and its fastest step a frame.
const EDGE = 40;
const STEP = 16;
// How long after a drop a click is the drop's own, which lands on the handle it started from.
const QUIET = 400;
const INTERACTIVE = 'button, a[href], input, select, textarea, [contenteditable]:not([contenteditable="false"])';

type Part = 'move' | 'start' | 'end';

/** The sides of a box, in CSS pixels from the viewport. */
type Sides = { left: number; right: number; top: number; bottom: number };

/** How far scroll-padding runs in from each side of a box, in CSS pixels. */
type Insets = { left: number; right: number; top: number; bottom: number };

/** The board on screen: its box, its scrollport, and the part of the scrollport its scroll-padding leaves open. */
type View = { box: DOMRect; port: Sides; open: Sides };

type Session = {
  pointerId: number;
  /** Where the press went down. */
  x: number;
  y: number;
  /** The last pointer position, which a scroll of the board drops at again. */
  last: { x: number; y: number };
  id: string;
  part: Part;
  /** The item's element, the handle the press started on, and the lane that holds the item. */
  node: HTMLElement;
  handle: HTMLElement;
  lane: Element | null;
  /** The board, found when the drag starts. */
  board: HTMLElement | null;
  from: LanePlace | null;
  span: number;
  /** For a move, how far into the item the press went down, so the item keeps its place under the pointer. */
  offset: number;
  started: boolean;
  /** Whether each lane met in the drag runs right to left, read once per lane. */
  rtl: Map<Element, boolean>;
  frame: number;
  /** The elements the drag marked, with the value each mark replaced, which the drag's end puts back. */
  marked: Map<Element, Map<Mark, string | null>>;
};

type Mark = 'data-dragging' | 'data-drop-target' | 'data-conflict';

/** The index of the first grid point `ok` holds for, where `ok` holds from some point on, or the grid's length. */
function firstWhere(grid: readonly number[], ok: (point: number) => boolean): number {
  let lo = 0;
  let hi = grid.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ok(grid[mid] as number)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** The grid point nearest `value`, in a grid with at least one point. */
function nearest(grid: readonly number[], value: number): number {
  const i = firstWhere(grid, (point) => point >= value);
  const after = grid[i];
  const before = grid[i - 1];
  if (after === undefined) return before as number;
  return before !== undefined && value - before <= after - value ? before : after;
}

/** The first grid point that is at least `min` and above `floor`. */
const above = (grid: readonly number[], min: number, floor: number): number | undefined =>
  grid[firstWhere(grid, (point) => point >= min && point > floor)];

/** The last grid point that is at most `max` and below `ceiling`. */
const below = (grid: readonly number[], max: number, ceiling: number): number | undefined =>
  grid[firstWhere(grid, (point) => point > max || point >= ceiling) - 1];

/**
 * The board's scroll-padding on each side, in pixels, from a length or a percentage of the scrollport.
 * It marks the strip along an edge that something sticky covers, such as a column of lane names, as it
 * does for the browser's own scrolling.
 */
function scrollPadding(board: HTMLElement): Insets {
  const style = getComputedStyle(board);
  const side = (name: string, size: number) => Math.max(0, pixels(style.getPropertyValue(`scroll-padding-${name}`).trim(), size));
  return {
    left: side('left', board.clientWidth),
    right: side('right', board.clientWidth),
    top: side('top', board.clientHeight),
    bottom: side('bottom', board.clientHeight),
  };
}

function samePlace(a: LanePlace | null, b: LanePlace | null): boolean {
  return a === b || (a !== null && b !== null && a.lane === b.lane && a.start === b.start && a.end === b.end);
}

/** An item's place or span, read from the attributes `getItemProps` wrote on its element, or null when they make no place. */
function readPlace(node: Element): { from: LanePlace | null; span: number } | null {
  const lane = node.getAttribute(IN);
  if (lane !== null) {
    const start = Number(node.getAttribute(START) ?? Number.NaN);
    const end = Number(node.getAttribute(END) ?? Number.NaN);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? { from: { lane, start, end }, span: end - start } : null;
  }
  const span = Number(node.getAttribute(SPAN) ?? Number.NaN);
  return Number.isFinite(span) && span > 0 ? { from: null, span } : null;
}

function createStore(): LaneDragStore & { set: (next: LaneDragChange | null) => void } {
  let state: LaneDragChange | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next) => {
      if (next === state) return;
      state = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

type Target = { change: Omit<LaneDragChange, 'verdict'>; element: Element | null };

/**
 * The drag engine for one board, made once per hook. It reads the hook's latest options through
 * `options`, publishes the drag to `store`, and reports the dragged item's element to `onActive`
 * when a drag starts and null when it ends. Its window listeners exist only while a press is down,
 * and for a moment after a drop to drop the drop's own click.
 */
function createLaneDrag(
  id: string,
  options: () => UseLaneDragOptions,
  store: ReturnType<typeof createStore>,
  onActive: (node: HTMLElement | null) => void,
) {
  let session: Session | null = null;
  let disarmQuiet: (() => void) | null = null;

  const mine = (element: Element) => element.getAttribute(PARTS) === id;
  const rootOf = (current: Session) => current.node.getRootNode() as Document | ShadowRoot;

  /** Whether the item, its lane and the board a drag reads are all still on the page. A render that removes or replaces one ends the drag. */
  const attached = (current: Session) =>
    current.node.isConnected && current.lane?.isConnected !== false && current.board?.isConnected !== false;

  /** The lane with the key `key` in `node`'s document or shadow root, wherever `node` sits in it. */
  const laneOf = (node: Element, key: string): Element | null => {
    for (const element of (node.getRootNode() as Document | ShadowRoot).querySelectorAll(`[${LANE}]`)) {
      if (mine(element) && element.getAttribute(LANE) === key) return element;
    }
    return null;
  };

  /** This board's lane or queue under x, y. */
  const hit = (current: Session, x: number, y: number): { lane: string; element: Element } | { queue: Element } | null => {
    for (let node = rootOf(current).elementFromPoint?.(x, y) ?? null; node; node = node.parentElement) {
      if (!mine(node)) continue;
      const lane = node.getAttribute(LANE);
      if (lane !== null) return { lane, element: node };
      if (node.hasAttribute(QUEUE)) return { queue: node };
    }
    return null;
  };

  /** The value along the axis at x, y in `lane`, from the lane's own box. */
  const valueAt = (current: Session, lane: Element, x: number, y: number): number => {
    const { range, axis = 'inline' } = options();
    const rect = lane.getBoundingClientRect();
    let along: number;
    let length: number;
    if (axis === 'block') {
      along = y - rect.top;
      length = rect.height;
    } else {
      let rtl = current.rtl.get(lane);
      if (rtl === undefined) {
        rtl = getComputedStyle(lane).direction === 'rtl';
        current.rtl.set(lane, rtl);
      }
      along = rtl ? rect.right - x : x - rect.left;
      length = rect.width;
    }
    return range.start + (length > 0 ? along / length : 0) * (range.end - range.start);
  };

  /** `value` held between `lo` and `hi`, or undefined when there is no such span. */
  const fit = (value: number, lo: number | undefined, hi: number | undefined): number | undefined =>
    lo === undefined || hi === undefined || lo > hi ? undefined : Math.min(Math.max(value, lo), hi);

  /** `value` on the grid between `lo` and `hi`, and past `floor` and short of `ceiling`, or between `lo` and `hi` when there is no grid. */
  const onGrid = (value: number, lo: number, hi: number, floor = -Infinity, ceiling = Infinity): number | undefined => {
    const { grid } = options();
    return grid?.length ? fit(nearest(grid, value), above(grid, lo, floor), below(grid, hi, ceiling)) : fit(value, lo, hi);
  };

  /** The span of `lane` between the open part's sides, inside the range, or undefined when none of it shows there. */
  const spanIn = (current: Session, lane: Element, open: Sides): { start: number; end: number } | undefined => {
    const { range, axis = 'inline' } = options();
    const a = valueAt(current, lane, open.left, open.top);
    const b = axis === 'block' ? valueAt(current, lane, open.left, open.bottom) : valueAt(current, lane, open.right, open.top);
    const start = Math.max(range.start, Math.min(a, b));
    const end = Math.min(range.end, Math.max(a, b));
    return start < end ? { start, end } : undefined;
  };

  /**
   * What a drop at x, y would do and the element it would drop on, or undefined to keep the last one, as for a resize past `minSpan`.
   * With `held`, the open part of the board the pointer was held inside, off a strip that covers the lanes: the place then lands
   * wholly in view where it fits there, and inside the range where it doesn't.
   */
  const locate = (current: Session, x: number, y: number, held: Sides | null): Target | undefined => {
    const { range, minSpan = 0 } = options();
    const { id: item, from } = current;
    /** `pick` inside the span in view, or inside the range when that gives nothing. */
    const within = (lane: Element, pick: (bounds: { start: number; end: number }) => number | undefined) => {
      const seen = held === null ? undefined : spanIn(current, lane, held);
      return (seen === undefined ? undefined : pick(seen)) ?? pick(range);
    };
    if (current.part !== 'move' && from !== null) {
      const { lane } = current;
      if (lane === null) return undefined;
      const value = valueAt(current, lane, x, y);
      // An end stays inside the range and at least `minSpan` from the other, and never reaches it.
      if (current.part === 'end') {
        const end = within(lane, (bounds) => onGrid(value, Math.max(from.start + minSpan, bounds.start), bounds.end, from.start));
        if (end === undefined || end <= from.start) return undefined;
        return { change: { id: item, kind: 'resize-end', from, to: { lane: from.lane, start: from.start, end } }, element: lane };
      }
      const start = within(lane, (bounds) => onGrid(value, bounds.start, Math.min(from.end - minSpan, bounds.end), -Infinity, from.end));
      if (start === undefined || start >= from.end) return undefined;
      return { change: { id: item, kind: 'resize-start', from, to: { lane: from.lane, start, end: from.end } }, element: lane };
    }
    const kind = from === null ? 'assign' : 'move';
    const over = hit(current, x, y);
    if (over === null) return { change: { id: item, kind, from, to: null }, element: null };
    if ('queue' in over) return { change: { id: item, kind: from === null ? 'assign' : 'unassign', from, to: null }, element: over.queue };
    // The item keeps its length inside the range; one longer than the range has no place.
    const value = valueAt(current, over.element, x, y) - current.offset;
    const start = within(over.element, (bounds) => onGrid(value, bounds.start, bounds.end - current.span));
    if (start === undefined) return { change: { id: item, kind, from, to: null }, element: null };
    return { change: { id: item, kind, from, to: { lane: over.lane, start, end: start + current.span } }, element: over.element };
  };

  /** Sets a mark on `element`, keeping the value it had, which the drag's end puts back. */
  const mark = (current: Session, element: Element, name: Mark, value: string) => {
    let kept = current.marked.get(element);
    if (kept === undefined) current.marked.set(element, (kept = new Map()));
    if (!kept.has(name)) kept.set(name, element.getAttribute(name));
    element.setAttribute(name, value);
  };

  /** Puts back what the drop marks replaced, and with `all` the dragging marks too. */
  const clear = (current: Session, all: boolean) => {
    for (const [element, kept] of current.marked) {
      for (const [name, value] of kept) {
        if (!all && name === 'data-dragging') continue;
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
        kept.delete(name);
      }
      if (kept.size === 0) current.marked.delete(element);
    }
  };

  /** Marks the element `change` would drop on, and the other items its verdict names. */
  const paint = (current: Session, change: LaneDragChange, element: Element | null) => {
    clear(current, false);
    if (element !== null && (change.to !== null || change.kind === 'unassign')) {
      mark(current, element, 'data-drop-target', '');
      if (change.to !== null && change.verdict) mark(current, element, 'data-conflict', change.verdict.level);
    }
    const level = change.verdict?.level;
    const others = new Set(change.verdict?.with);
    others.delete(current.id);
    if (level === undefined || others.size === 0) return;
    for (const item of rootOf(current).querySelectorAll(`[${ITEM}]`)) {
      if (mine(item) && others.has(item.getAttribute(ITEM) ?? '')) mark(current, item, 'data-conflict', level);
    }
  };

  /** Shows the drop at x, y, calling `check` when the place changes, and with `fresh` even when it doesn't. Returns the board as it measured it. */
  const update = (current: Session, x: number, y: number, fresh = false): View | null => {
    current.last = { x, y };
    const shown = view(current);
    const point = aim(current, shown, x, y);
    const next = locate(current, point.x, point.y, point.held);
    const last = store.get();
    if (next === undefined) {
      // A resize past what it allows keeps the place shown, which a drop still checks again.
      if (fresh && last !== null) store.set({ ...last, verdict: judge(current, last.to) });
      return shown;
    }
    if (!fresh && last !== null && last.kind === next.change.kind && samePlace(last.to, next.change.to)) return shown;
    const change = { ...next.change, verdict: judge(current, next.change.to) };
    paint(current, change, next.element);
    store.set(change);
    return shown;
  };

  /** What `check` says of `to`. */
  const judge = (current: Session, to: LanePlace | null): LaneVerdict | null => (to === null ? null : (options().check?.(current.id, to) ?? null));

  /** Runs `step` while the press is down. A `check` that throws in it ends the drag as Escape does, and its error still reaches the page. */
  const guard = <T>(current: Session, step: () => T): T => {
    try {
      return step();
    } catch (error) {
      if (session === current) abort(current);
      throw error;
    }
  };

  /**
   * The board's box, its scrollport, and the part of the scrollport its scroll-padding leaves open, where
   * the lanes show, all on screen. Padding that leaves no room between two sides counts as none on that axis.
   */
  const view = (current: Session): View | null => {
    const { board } = current;
    if (board === null) return null;
    const box = board.getBoundingClientRect();
    const padding = scrollPadding(board);
    // Layout sizes, scaled to the screen as the box is under a transform. Within a pixel, the gap is rounding.
    const scale = (screen: number, layout: number) => (layout > 0 && Math.abs(screen - layout) > 1 ? screen / layout : 1);
    const sx = scale(box.width, board.offsetWidth);
    const sy = scale(box.height, board.offsetHeight);
    // The scrollport, inside the border and clear of scrollbars, is what scroll-padding counts from.
    const port = {
      left: box.left + board.clientLeft * sx,
      top: box.top + board.clientTop * sy,
      right: box.right - (board.offsetWidth - board.clientLeft - board.clientWidth) * sx,
      bottom: box.bottom - (board.offsetHeight - board.clientTop - board.clientHeight) * sy,
    };
    const pad = { left: padding.left * sx, right: padding.right * sx, top: padding.top * sy, bottom: padding.bottom * sy };
    // One pixel of the open part stays on each side, for a held pointer to read inside it.
    const across = pad.left + pad.right > 0 && port.left + pad.left + 1 < port.right - pad.right - 1;
    const down = pad.top + pad.bottom > 0 && port.top + pad.top + 1 < port.bottom - pad.bottom - 1;
    const open = {
      left: across ? port.left + pad.left : port.left,
      right: across ? port.right - pad.right : port.right,
      top: down ? port.top + pad.top : port.top,
      bottom: down ? port.bottom - pad.bottom : port.bottom,
    };
    return { box, port, open };
  };

  const inside = (box: Sides, x: number, y: number) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;

  /**
   * Whether a lane shows at x, y: the topmost element there is in a lane, an item or a queue, and nothing
   * sticky or fixed inside the lane, such as its name, is over it.
   */
  const shows = (current: Session, x: number, y: number): boolean => {
    const top = rootOf(current).elementFromPoint?.(x, y) ?? null;
    let pinned = false;
    for (let node = top; node; node = node.parentElement) {
      if (mine(node)) {
        if (node.hasAttribute(ITEM) || node.hasAttribute(QUEUE)) return true;
        if (node.hasAttribute(LANE)) return !pinned;
      } else if (!pinned) {
        const { position } = getComputedStyle(node);
        pinned = position === 'sticky' || position === 'fixed';
      }
    }
    return false;
  };

  /**
   * Where a drop reads the pointer. Over the board's scroll-padding, where something covers the lanes, as
   * sticky lane names do, it reads one pixel inside the open part instead, so the drop goes to the first
   * place in view while the board scrolls toward the names. Where a lane shows through the padding, as
   * under a scroll-snap offset, and over the board's border and scrollbars, it reads the pointer.
   */
  const aim = (current: Session, shown: View | null, x: number, y: number): { x: number; y: number; held: Sides | null } => {
    if (shown === null) return { x, y, held: null };
    const { port, open } = shown;
    if (!inside(port, x, y) || inside(open, x, y) || shows(current, x, y)) return { x, y, held: null };
    const hold = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo + 1), hi - 1);
    return { x: hold(x, open.left, open.right), y: hold(y, open.top, open.bottom), held: open };
  };

  /** How far the board scrolls this frame: only while the pointer is inside it, near an edge of its open part or past one. */
  const velocity = (current: Session, shown: View | null): { dx: number; dy: number } | null => {
    const { x, y } = current.last;
    if (shown === null || !inside(shown.box, x, y)) return null;
    const { open } = shown;
    /** Toward the nearer side within the edge, faster closer to it, and at full speed past it. */
    const speed = (near: number, far: number) => {
      // An open part narrower than two edges puts the pointer near both sides, and still at its middle.
      if (Math.min(near, far) >= EDGE || Math.abs(near - far) < 1) return 0;
      if (near < far) return -STEP * (1 - Math.max(near, 0) / EDGE);
      return STEP * (1 - Math.max(far, 0) / EDGE);
    };
    const dx = Math.round(speed(x - open.left, open.right - x));
    const dy = Math.round(speed(y - open.top, open.bottom - y));
    return dx !== 0 || dy !== 0 ? { dx, dy } : null;
  };

  /** Scrolls the board each frame the pointer stays near its edge, and drops again at the pointer, which the scroll moved over the lanes. */
  const steer = (current: Session, shown: View | null) => {
    if (current.frame !== 0 || velocity(current, shown) === null) return;
    const tick = () => {
      if (!attached(current)) return abort(current);
      const step = velocity(current, view(current));
      const board = current.board;
      if (step === null || board === null) {
        current.frame = 0;
        return;
      }
      const left = board.scrollLeft;
      const top = board.scrollTop;
      // Instant whatever scroll-behavior the board has, so this frame reads where it went. jsdom, where a product's tests run, has no scrollBy.
      if (typeof board.scrollBy === 'function') board.scrollBy({ left: step.dx, top: step.dy, behavior: 'instant' });
      else {
        board.scrollLeft = left + step.dx;
        board.scrollTop = top + step.dy;
      }
      const moved = board.scrollLeft !== left || board.scrollTop !== top;
      // At the end of the scroll the loop stops; the next move starts it again.
      current.frame = moved ? requestAnimationFrame(tick) : 0;
      if (moved) guard(current, () => update(current, current.last.x, current.last.y));
    };
    current.frame = requestAnimationFrame(tick);
  };

  const onSelectStart = (event: Event) => event.preventDefault();

  /** Drops the next click soon after a drop: it lands on the handle. */
  const armQuiet = () => {
    disarmQuiet?.();
    const until = performance.now() + QUIET;
    const disarm = () => {
      clearTimeout(timer);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('pointerdown', disarm, true);
      if (disarmQuiet === disarm) disarmQuiet = null;
    };
    const onClick = (event: MouseEvent) => {
      // A keyboard or scripted click (detail 0) is never the drag's own.
      if (event.detail === 0) return;
      disarm();
      if (performance.now() >= until) return;
      event.stopPropagation();
      event.preventDefault();
    };
    const timer = setTimeout(disarm, QUIET);
    window.addEventListener('click', onClick, true);
    window.addEventListener('pointerdown', disarm, true);
    disarmQuiet = disarm;
  };

  /** After an Escape, waits for the pointer's release to drop its click. A new press means the release was lost. */
  const awaitRelease = (pointerId: number) => {
    disarmQuiet?.();
    const onRelease = (event: globalThis.PointerEvent) => {
      if (event.type !== 'pointerdown' && event.pointerId !== pointerId) return;
      stop();
      if (event.type === 'pointerup') armQuiet();
    };
    const stop = () => {
      for (const type of ['pointerup', 'pointercancel', 'pointerdown'] as const) window.removeEventListener(type, onRelease, true);
      if (disarmQuiet === stop) disarmQuiet = null;
    };
    for (const type of ['pointerup', 'pointercancel', 'pointerdown'] as const) window.addEventListener(type, onRelease, true);
    disarmQuiet = stop;
  };

  /** Ends the session: puts back every mark, clears the store and removes the listeners. */
  const teardown = (ended: Session) => {
    cancelAnimationFrame(ended.frame);
    clear(ended, true);
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onEnd, true);
    window.removeEventListener('blur', onEnd);
    window.removeEventListener('selectstart', onSelectStart, true);
    if (session === ended) session = null;
    store.set(null);
    if (ended.started) onActive(null);
  };

  /** Ends a drag while the press is still down, without a drop, and drops the click its release sends. */
  const abort = (current: Session) => {
    const { started, pointerId } = current;
    teardown(current);
    if (started) awaitRelease(pointerId);
  };

  function onMove(event: globalThis.PointerEvent) {
    const current = session;
    if (current === null || event.pointerId !== current.pointerId) return;
    // No button down means the release was lost, as to a context menu: a hovering pointer drags nothing.
    if (event.buttons === 0) return teardown(current);
    if (!attached(current)) return abort(current);
    if (!current.started) {
      if (options().disabled) return teardown(current);
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < SLOP) return;
      current.started = true;
      capturePointer(current.handle, current.pointerId);
      getSelection()?.removeAllRanges();
      window.addEventListener('selectstart', onSelectStart, true);
      mark(current, current.node, 'data-dragging', '');
      for (const element of rootOf(current).querySelectorAll<HTMLElement>(`[${BOARD}]`)) {
        if (mine(element)) {
          current.board = element;
          mark(current, element, 'data-dragging', '');
          break;
        }
      }
      onActive(current.node);
    }
    steer(current, guard(current, () => update(current, event.clientX, event.clientY)));
  }

  function onUp(event: globalThis.PointerEvent) {
    const ended = session;
    if (ended === null || event.pointerId !== ended.pointerId) return;
    if (ended.started) armQuiet();
    if (!ended.started || !attached(ended) || options().disabled) return teardown(ended);
    let change: LaneDragChange | null;
    try {
      // `check` again, since what it reads may have changed while the pointer stayed on one place.
      update(ended, event.clientX, event.clientY, true);
    } finally {
      // A `check` that throws still ends the drag; the click this release sends is already dropped.
      change = store.get();
      teardown(ended);
    }
    if (change === null) return;
    if (change.kind === 'unassign') {
      if (change.from !== null) options().onDrop(change);
      return;
    }
    if (change.to === null || change.verdict?.level === 'blocked' || samePlace(change.from, change.to)) return;
    options().onDrop(change);
  }

  function onEnd(event: Event) {
    if (session === null) return;
    if (event.type !== 'pointercancel' || (event as globalThis.PointerEvent).pointerId === session.pointerId) teardown(session);
  }

  return {
    /** Starts a session for a press on `item`'s `part` handle. */
    press(event: PointerEvent<HTMLElement>, item: string, part: Part) {
      // A second finger starts nothing.
      if (options().disabled || event.button !== 0 || (event.pointerType === 'touch' && !event.isPrimary)) return;
      // Any other press while a session runs means the earlier drag's release never came.
      if (session !== null) teardown(session);
      const handle = event.currentTarget;
      // A press on a control inside the handle, such as a menu's trigger, is that control's.
      const target = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
      if (target !== null && target !== handle && handle.contains(target)) return;
      let node: HTMLElement | null = handle;
      while (node !== null && !(mine(node) && node.getAttribute(ITEM) === item)) node = node.parentElement;
      if (node === null) return;
      const read = readPlace(node);
      if (read === null || (part !== 'move' && read.from === null)) return;
      const { from, span } = read;
      // The item's lane, by its key, wherever the item's element sits.
      const lane = from === null ? null : laneOf(node, from.lane);
      // A resize needs the lane it runs along.
      if (part !== 'move' && lane === null) return;
      const next: Session = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        last: { x: event.clientX, y: event.clientY },
        id: item,
        part,
        node,
        handle,
        lane,
        board: null,
        from,
        span,
        offset: 0,
        started: false,
        rtl: new Map(),
        frame: 0,
        marked: new Map(),
      };
      if (part === 'move' && from !== null && lane !== null) next.offset = valueAt(next, lane, event.clientX, event.clientY) - from.start;
      session = next;
      // Capture, so a product's handler that stops these events can't leave a drag running.
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onEnd, true);
      // A release while the window is in the background never comes back.
      window.addEventListener('blur', onEnd);
    },
    /** Stops a started drag without a drop, and drops the click its release sends. */
    cancel() {
      if (session !== null && session.started) abort(session);
    },
    /** Ends everything, for the hook's unmount. */
    destroy() {
      if (session !== null) teardown(session);
      disarmQuiet?.();
    },
  };
}

const serverState = () => null;

/**
 * `useLaneDragState(drag, select)` returns `select` of the drag under way from `useLaneDrag`, or of
 * null when there is none, and renders again only when that selection changes. A lane that selects
 * the drag while its place is in that lane renders each time the place in it changes, not on every
 * pointer move, and not while the drag is in other lanes.
 */
export function useLaneDragState<T>(
  drag: LaneDragStore,
  select: (state: LaneDragChange | null) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const cache = useRef<{ state: LaneDragChange | null; select: typeof select; value: T } | null>(null);
  const read = (state: LaneDragChange | null): T => {
    const last = cache.current;
    if (last !== null && last.state === state && last.select === select) return last.value;
    const value = select(state);
    if (last !== null && isEqual(last.value, value)) {
      cache.current = { state, select, value: last.value };
      return last.value;
    }
    cache.current = { state, select, value };
    return value;
  };
  return useSyncExternalStore(
    drag.subscribe,
    () => read(drag.get()),
    () => read(serverState()),
  );
}

/**
 * `useLaneDrag({ range, onDrop })` returns prop getters that let a person drag items along lanes
 * that share one axis, such as talks on a conference's stages: place an item from a queue, move it
 * along its lane or to another, resize either end, or take it back to the queue. Places snap to
 * `grid`, `check` says whether a place conflicts with others, and a drop calls `onDrop(change)`.
 * Escape cancels a drag. It has no keyboard path: pair it with a way to move an item without
 * dragging, such as a dialog.
 */
export function useLaneDrag(options: UseLaneDragOptions): UseLaneDragResult {
  const id = useId();
  const latest = useRef(options);
  latest.current = options;
  // Whether a drag is under way, so Escape reaches it, and the dragged item's element for the
  // Escape layer. The owner renders at a drag's start and end only.
  const [active, setActive] = useState(false);
  const nodeRef = useRef<HTMLElement | null>(null);
  const [store] = useState(createStore);
  // What callers get: the store without its setter.
  const [drag] = useState<LaneDragStore>(() => ({ get: store.get, subscribe: store.subscribe }));
  const [engine] = useState(() =>
    createLaneDrag(
      id,
      () => latest.current,
      store,
      (node) => {
        nodeRef.current = node;
        setActive(node !== null);
      },
    ),
  );

  useEffect(() => () => engine.destroy(), [engine]);

  // The drag takes Escape before a dialog around the board, as does a modal's close request, such as the Android back gesture.
  useEscapeKey(active, true, engine.cancel, nodeRef);

  const withParts = <P extends object>(props: P | undefined, attributes: Attributes): P & Attributes => ({
    ...(props as P),
    [PARTS]: id,
    ...attributes,
  });

  return {
    getBoardProps: (props) => withParts(props, { [BOARD]: '' }),
    getLaneProps: (lane, props) => withParts(props, { [LANE]: lane }),
    getQueueProps: (props) => withParts(props, { [QUEUE]: '' }),
    getItemProps: (item, at, props) =>
      withParts(
        props,
        'lane' in at
          ? { [ITEM]: item, [IN]: at.lane, [START]: String(at.start), [END]: String(at.end) }
          : { [ITEM]: item, [SPAN]: String(at.span) },
      ),
    getHandleProps: <P extends UseLaneDragHandleUserProps>(item: string, part: Part, props?: P) => {
      const user = (props ?? {}) as P;
      return {
        ...user,
        onPointerDown: composeHandlers(user.onPointerDown, (event: PointerEvent<HTMLElement>) => engine.press(event, item, part)),
        onDragStart: composeHandlers(user.onDragStart, (event: DragEvent<HTMLElement>) => event.preventDefault()),
      };
    },
    drag,
  };
}
