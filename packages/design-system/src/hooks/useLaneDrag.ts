import { useEffect, useId, useRef, useState, useSyncExternalStore, type DragEvent, type PointerEvent } from 'react';
import { capturePointer } from '../internal/pointerCapture.js';
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
  /** Says whether the item `id` may go to `to`, each time the place under the pointer changes. */
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
  /** Props for the element around the lanes. It scrolls during a drag while the pointer is inside it, near its edges. */
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
  /** An Escape cancelled the drag; the session waits for the pointer's release to drop its click. */
  cancelled: boolean;
  /** Whether each lane met in the drag runs right to left, read once per lane. */
  rtl: Map<Element, boolean>;
  frame: number;
  /** The elements the drag marked, so its end clears each one. */
  marked: Set<Element>;
};

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

function samePlace(a: LanePlace | null, b: LanePlace | null): boolean {
  return a === b || (a !== null && b !== null && a.lane === b.lane && a.start === b.start && a.end === b.end);
}

/** An item's place or span, read from the attributes `getItemProps` wrote on its element. */
function readPlace(node: Element): { from: LanePlace | null; span: number } {
  const lane = node.getAttribute(IN);
  if (lane !== null) {
    const start = Number(node.getAttribute(START));
    const end = Number(node.getAttribute(END));
    return { from: { lane, start, end }, span: end - start };
  }
  return { from: null, span: Number(node.getAttribute(SPAN) ?? 0) };
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

  /** Where a move or an assign would start in `lane` at x, y: inside `range` and on the grid, or null where the item can't fit. */
  const startAt = (current: Session, lane: Element, x: number, y: number): number | null => {
    const { range, grid } = options();
    const last = range.end - current.span;
    if (last < range.start) return null;
    const start = Math.min(Math.max(valueAt(current, lane, x, y) - current.offset, range.start), last);
    if (!grid?.length) return start;
    const snapped = nearest(grid, start);
    const fit = snapped > last ? below(grid, last, Infinity) : snapped < range.start ? above(grid, range.start, -Infinity) : snapped;
    return fit !== undefined && fit >= range.start && fit <= last ? fit : null;
  };

  /** What a drop at x, y would do and the element it would drop on, or undefined to keep the last one, as for a resize past `minSpan`. */
  const locate = (current: Session, x: number, y: number): Target | undefined => {
    const { range, grid, minSpan = 0 } = options();
    const { id: item, from } = current;
    if (current.part !== 'move' && from !== null) {
      const { lane } = current;
      if (lane === null) return undefined;
      const value = valueAt(current, lane, x, y);
      const snap = grid?.length ? nearest(grid, value) : value;
      if (current.part === 'end') {
        const min = from.start + minSpan;
        let end = Math.min(snap, range.end);
        if (end < min || end <= from.start) end = (grid?.length ? above(grid, min, from.start) : min) ?? Number.NaN;
        if (!(end > from.start && end <= range.end)) return undefined;
        return { change: { id: item, kind: 'resize-end', from, to: { lane: from.lane, start: from.start, end } }, element: lane };
      }
      const max = from.end - minSpan;
      let start = Math.max(snap, range.start);
      if (start > max || start >= from.end) start = (grid?.length ? below(grid, max, from.end) : max) ?? Number.NaN;
      if (!(start < from.end && start >= range.start)) return undefined;
      return { change: { id: item, kind: 'resize-start', from, to: { lane: from.lane, start, end: from.end } }, element: lane };
    }
    const kind = from === null ? 'assign' : 'move';
    const over = hit(current, x, y);
    if (over === null) return { change: { id: item, kind, from, to: null }, element: null };
    if ('queue' in over) return { change: { id: item, kind: from === null ? 'assign' : 'unassign', from, to: null }, element: over.queue };
    const start = startAt(current, over.element, x, y);
    if (start === null) return { change: { id: item, kind, from, to: null }, element: null };
    return { change: { id: item, kind, from, to: { lane: over.lane, start, end: start + current.span } }, element: over.element };
  };

  const mark = (current: Session, element: Element, name: string, value: string) => {
    element.setAttribute(name, value);
    current.marked.add(element);
  };

  /** Clears the drop marks, and with `all` the dragging marks too. */
  const clear = (current: Session, all: boolean) => {
    for (const element of current.marked) {
      element.removeAttribute('data-drop-target');
      element.removeAttribute('data-conflict');
      if (all) element.removeAttribute('data-dragging');
    }
    if (all) current.marked.clear();
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

  /** Shows the drop at x, y, calling `check` only when the place changes. */
  const update = (current: Session, x: number, y: number) => {
    current.last = { x, y };
    const next = locate(current, x, y);
    if (next === undefined) return;
    const shown = store.get();
    if (shown !== null && shown.kind === next.change.kind && samePlace(shown.to, next.change.to)) return;
    const verdict = next.change.to !== null ? (options().check?.(current.id, next.change.to) ?? null) : null;
    const change = { ...next.change, verdict };
    paint(current, change, next.element);
    store.set(change);
  };

  /** Scrolls the board while the pointer is inside it near an edge, and drops again at the pointer, which the scroll moved over the lanes. */
  const scroll = (current: Session) => {
    const tick = () => {
      const { board } = current;
      if (board === null) return;
      const rect = board.getBoundingClientRect();
      const { x, y } = current.last;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const speed = (near: number, far: number) => (near < EDGE ? -STEP * (1 - near / EDGE) : far < EDGE ? STEP * (1 - far / EDGE) : 0);
        const dx = Math.round(speed(x - rect.left, rect.right - x));
        const dy = Math.round(speed(y - rect.top, rect.bottom - y));
        if (dx !== 0 || dy !== 0) {
          const left = board.scrollLeft;
          const top = board.scrollTop;
          board.scrollLeft = left + dx;
          board.scrollTop = top + dy;
          if (board.scrollLeft !== left || board.scrollTop !== top) update(current, x, y);
        }
      }
      current.frame = requestAnimationFrame(tick);
    };
    current.frame = requestAnimationFrame(tick);
  };

  const onSelectStart = (event: Event) => event.preventDefault();

  /** Drops the next click soon after a drop, or after the release of a cancelled drag: it lands on the handle. */
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

  /** Ends the session: clears every mark, the store and the listeners. */
  const teardown = (ended: Session) => {
    cancelAnimationFrame(ended.frame);
    clear(ended, true);
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
    window.removeEventListener('selectstart', onSelectStart, true);
    if (session === ended) session = null;
    store.set(null);
    if (ended.started && !ended.cancelled) onActive(null);
  };

  function onMove(event: globalThis.PointerEvent) {
    const current = session;
    if (current === null || event.pointerId !== current.pointerId || current.cancelled) return;
    if (!current.node.isConnected) return teardown(current);
    if (!current.started) {
      if (options().disabled) return teardown(current);
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < SLOP) return;
      current.started = true;
      capturePointer(current.handle, current.pointerId);
      getSelection()?.removeAllRanges();
      window.addEventListener('selectstart', onSelectStart, true);
      mark(current, current.node, 'data-dragging', '');
      for (const element of rootOf(current).querySelectorAll<HTMLElement>(`[${BOARD}]`)) {
        if (mine(element)) current.board = element;
      }
      if (current.board !== null) mark(current, current.board, 'data-dragging', '');
      onActive(current.node);
      scroll(current);
    }
    update(current, event.clientX, event.clientY);
  }

  function onUp(event: globalThis.PointerEvent) {
    const ended = session;
    if (ended === null || event.pointerId !== ended.pointerId) return;
    if (ended.started) armQuiet();
    if (!ended.started || ended.cancelled || !ended.node.isConnected || options().disabled) return teardown(ended);
    update(ended, event.clientX, event.clientY);
    const change = store.get();
    teardown(ended);
    if (change === null) return;
    if (change.kind === 'unassign') {
      if (change.from !== null) options().onDrop(change);
      return;
    }
    if (change.to === null || change.verdict?.level === 'blocked' || samePlace(change.from, change.to)) return;
    options().onDrop(change);
  }

  function onCancel(event: globalThis.PointerEvent) {
    if (session !== null && event.pointerId === session.pointerId) teardown(session);
  }

  return {
    /** Starts a session for a press on `item`'s `part` handle. */
    press(event: PointerEvent<HTMLElement>, item: string, part: Part) {
      if (options().disabled || event.button !== 0) return;
      if (session !== null) {
        // A second finger starts nothing. Any other press means the earlier drag's release never came.
        if (event.pointerType === 'touch' && !event.isPrimary) return;
        teardown(session);
      }
      const handle = event.currentTarget;
      // A press on a control inside the handle, such as a menu's trigger, is that control's.
      const target = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
      if (target !== null && target !== handle && handle.contains(target)) return;
      let node: HTMLElement | null = handle;
      while (node !== null && !(mine(node) && node.getAttribute(ITEM) === item)) node = node.parentElement;
      if (node === null) return;
      const { from, span } = readPlace(node);
      if (part !== 'move' && from === null) return;
      let lane: Element | null = null;
      for (let parent = node.parentElement; from !== null && parent !== null && lane === null; parent = parent.parentElement) {
        if (mine(parent) && parent.getAttribute(LANE) === from.lane) lane = parent;
      }
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
        cancelled: false,
        rtl: new Map(),
        frame: 0,
        marked: new Set(),
      };
      if (part === 'move' && from !== null && lane !== null) next.offset = valueAt(next, lane, event.clientX, event.clientY) - from.start;
      session = next;
      // Capture, so a product's handler that stops these events can't leave a drag running.
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onCancel, true);
    },
    /** Stops a started drag without a drop. The session waits for the pointer's release, whose click it drops. */
    cancel() {
      if (session === null || !session.started || session.cancelled) return;
      cancelAnimationFrame(session.frame);
      clear(session, true);
      session.cancelled = true;
      store.set(null);
      onActive(null);
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
