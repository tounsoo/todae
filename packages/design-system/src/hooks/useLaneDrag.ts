import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
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
  /** Where the item would go, or null over the queue or outside the lanes. */
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
};

export type UseLaneDragHandleProps = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
};

type Attributes = Record<`data-${string}`, string | undefined>;

export type UseLaneDragResult = {
  /** Props for the element around the lanes. It scrolls during a drag near its edges. */
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
  /** The item's element and the handle the press started on. */
  node: HTMLElement;
  handle: HTMLElement;
  from: LanePlace | null;
  span: number;
  /** For a move, how far into the item the press went down, so the item keeps its place under the pointer. */
  offset: number | null;
  started: boolean;
  /** An Escape cancelled the drag; the session waits for the pointer's release to drop its click. */
  cancelled: boolean;
  /** Whether each lane met in the drag runs right to left, read once per lane. */
  rtl: Map<Element, boolean>;
  frame: number;
  /** The elements the drag marked, so its end clears each one. */
  marked: Set<Element>;
};

/** Nearest grid point to `value`, by binary search. */
function nearest(grid: readonly number[], value: number): number {
  let lo = 0;
  let hi = grid.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (grid[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  const after = grid[lo]!;
  const before = grid[lo - 1];
  return before !== undefined && value - before <= after - value ? before : after;
}

/** The first grid point above `floor` and at least `min`, or undefined. */
function above(grid: readonly number[], min: number, floor: number): number | undefined {
  return grid.find((point) => point >= min && point > floor);
}

/** The last grid point below `ceiling` and at most `max`, or undefined. */
function below(grid: readonly number[], max: number, ceiling: number): number | undefined {
  for (let i = grid.length - 1; i >= 0; i--) if (grid[i]! <= max && grid[i]! < ceiling) return grid[i];
  return undefined;
}

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

const serverState = () => null;

/**
 * `useLaneDragState(drag, select)` returns `select` of the drag under way from `useLaneDrag`, or of
 * null when there is none, and renders again only when that selection changes. A lane that selects
 * the place a drag would take in it renders when the place moves in or out of it, not on every move.
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
  const [store] = useState(createStore);
  // What callers get: the store without its setter.
  const [drag] = useState<LaneDragStore>(() => ({ get: store.get, subscribe: store.subscribe }));
  const sessionRef = useRef<Session | null>(null);
  // The dragged item's element, for the Escape layer.
  const nodeRef = useRef<HTMLElement | null>(null);
  // Whether a drag is under way, so Escape reaches it. The owner renders at a drag's start and end only.
  const [active, setActive] = useState(false);
  // Until when a click is the last drop's own.
  const quietRef = useRef(0);

  const mine = useCallback((element: Element) => element.getAttribute(PARTS) === id, [id]);

  /** The board's element, found from the dragged item's root. */
  const board = useCallback(
    (session: Session): HTMLElement | null => {
      const root = session.node.getRootNode() as Document | ShadowRoot;
      for (const element of root.querySelectorAll<HTMLElement>(`[${BOARD}]`)) if (mine(element)) return element;
      return null;
    },
    [mine],
  );

  /** This board's lane or queue under x, y. */
  const hit = useCallback(
    (session: Session, x: number, y: number): { lane: string; element: Element } | 'queue' | null => {
      const root = session.node.getRootNode() as Document | ShadowRoot;
      for (let node = root.elementFromPoint?.(x, y) ?? null; node; node = node.parentElement) {
        if (!mine(node)) continue;
        const lane = node.getAttribute(LANE);
        if (lane !== null) return { lane, element: node };
        if (node.hasAttribute(QUEUE)) return 'queue';
      }
      return null;
    },
    [mine],
  );

  /** The value along the axis at x, y in `lane`, from the lane's own box. */
  const valueAt = useCallback((session: Session, lane: Element, x: number, y: number): number => {
    const { range, axis = 'inline' } = latest.current;
    const rect = lane.getBoundingClientRect();
    let along: number;
    let length: number;
    if (axis === 'block') {
      along = y - rect.top;
      length = rect.height;
    } else {
      let rtl = session.rtl.get(lane);
      if (rtl === undefined) {
        rtl = getComputedStyle(lane).direction === 'rtl';
        session.rtl.set(lane, rtl);
      }
      along = rtl ? rect.right - x : x - rect.left;
      length = rect.width;
    }
    return range.start + (length > 0 ? along / length : 0) * (range.end - range.start);
  }, []);

  /** The lane element that holds the dragged item, for a resize and a move's offset. */
  const ownLane = useCallback(
    (session: Session): Element | null => {
      for (let node = session.node.parentElement; node; node = node.parentElement) {
        if (mine(node) && node.getAttribute(LANE) === session.from?.lane) return node;
      }
      return null;
    },
    [mine],
  );

  /** What a drop at x, y would do, or undefined to keep the last one, as for a resize past `minSpan`. */
  const locate = useCallback(
    (session: Session, x: number, y: number): Omit<LaneDragChange, 'verdict'> | undefined => {
      const { range, grid, minSpan = 0 } = latest.current;
      const snap = (value: number) => (grid && grid.length > 0 ? nearest(grid, value) : value);
      const { from } = session;
      if (session.part !== 'move' && from !== null) {
        const lane = ownLane(session);
        if (lane === null) return undefined;
        const value = valueAt(session, lane, x, y);
        if (session.part === 'end') {
          const min = from.start + minSpan;
          let end = Math.min(snap(value), range.end);
          if (end < min || end <= from.start) end = (grid?.length ? above(grid, min, from.start) : min) ?? Number.NaN;
          if (!(end > from.start && end <= range.end)) return undefined;
          return { id: session.id, kind: 'resize-end', from, to: { lane: from.lane, start: from.start, end } };
        }
        const max = from.end - minSpan;
        let start = Math.max(snap(value), range.start);
        if (start > max || start >= from.end) start = (grid?.length ? below(grid, max, from.end) : max) ?? Number.NaN;
        if (!(start < from.end && start >= range.start)) return undefined;
        return { id: session.id, kind: 'resize-start', from, to: { lane: from.lane, start, end: from.end } };
      }
      const kind = from === null ? 'assign' : 'move';
      const over = hit(session, x, y);
      if (over === 'queue') return { id: session.id, kind: from === null ? 'assign' : 'unassign', from, to: null };
      if (over === null) return { id: session.id, kind, from, to: null };
      const start = Math.max(range.start, Math.min(snap(valueAt(session, over.element, x, y) - (session.offset ?? 0)), range.end - session.span));
      return { id: session.id, kind, from, to: { lane: over.lane, start, end: start + session.span } };
    },
    [hit, ownLane, valueAt],
  );

  const mark = useCallback((session: Session, element: Element | null | undefined, name: string, value: string) => {
    if (!element) return;
    element.setAttribute(name, value);
    session.marked.add(element);
  }, []);

  /** Marks the elements for `change`: the lane or queue it would drop on, and the items its verdict names. */
  const paint = useCallback(
    (session: Session, change: LaneDragChange) => {
      for (const element of session.marked) {
        if (element === session.node) continue;
        element.removeAttribute('data-drop-target');
        element.removeAttribute('data-conflict');
      }
      const root = session.node.getRootNode() as Document | ShadowRoot;
      if (change.to !== null) {
        for (const lane of root.querySelectorAll(`[${LANE}]`)) {
          if (!mine(lane) || lane.getAttribute(LANE) !== change.to.lane) continue;
          mark(session, lane, 'data-drop-target', '');
          if (change.verdict) mark(session, lane, 'data-conflict', change.verdict.level);
        }
      } else if (change.kind === 'unassign') {
        for (const queue of root.querySelectorAll(`[${QUEUE}]`)) if (mine(queue)) mark(session, queue, 'data-drop-target', '');
      }
      const others = change.verdict?.with;
      if (others?.length) {
        for (const item of root.querySelectorAll(`[${ITEM}]`)) {
          if (mine(item) && others.includes(item.getAttribute(ITEM)!)) mark(session, item, 'data-conflict', change.verdict!.level);
        }
      }
    },
    [mark, mine],
  );

  /** Shows the drop at x, y, calling `check` only when the place changes. */
  const update = useCallback(
    (session: Session, x: number, y: number) => {
      session.last = { x, y };
      const next = locate(session, x, y);
      if (next === undefined) return;
      const current = store.get();
      if (current !== null && current.kind === next.kind && samePlace(current.to, next.to)) return;
      const verdict = next.to !== null ? (latest.current.check?.(session.id, next.to) ?? null) : null;
      const change = { ...next, verdict };
      paint(session, change);
      store.set(change);
    },
    [locate, paint, store],
  );

  const onSelectStart = useCallback((event: Event) => event.preventDefault(), []);

  /** Ends the session: clears every mark, the store and the listeners. */
  const teardown = useCallback(
    (session: Session) => {
      cancelAnimationFrame(session.frame);
      for (const element of session.marked) {
        element.removeAttribute('data-drop-target');
        element.removeAttribute('data-conflict');
        element.removeAttribute('data-dragging');
      }
      session.marked.clear();
      window.removeEventListener('selectstart', onSelectStart, true);
      if (sessionRef.current === session) {
        sessionRef.current = null;
        nodeRef.current = null;
      }
      store.set(null);
      setActive(false);
    },
    [onSelectStart, store],
  );

  /** Stops a started drag without a drop. The session waits for the pointer's release, whose click it drops. */
  const cancel = useCallback(() => {
    const session = sessionRef.current;
    if (session === null) return;
    cancelAnimationFrame(session.frame);
    for (const element of session.marked) {
      element.removeAttribute('data-drop-target');
      element.removeAttribute('data-conflict');
      element.removeAttribute('data-dragging');
    }
    session.marked.clear();
    session.cancelled = true;
    store.set(null);
    setActive(false);
  }, [store]);

  /** Scrolls the board while the pointer is near its edge, and drops again at the pointer, which the scroll moved over the lanes. */
  const scroll = useCallback(
    (session: Session) => {
      const tick = () => {
        if (sessionRef.current !== session || !session.started || session.cancelled) return;
        const element = board(session);
        if (element !== null) {
          const rect = element.getBoundingClientRect();
          const { x, y } = session.last;
          const speed = (near: number, far: number) =>
            near < EDGE ? -STEP * (1 - Math.max(near, 0) / EDGE) : far < EDGE ? STEP * (1 - Math.max(far, 0) / EDGE) : 0;
          const dx = Math.round(speed(x - rect.left, rect.right - x));
          const dy = Math.round(speed(y - rect.top, rect.bottom - y));
          if (dx !== 0 || dy !== 0) {
            const left = element.scrollLeft;
            const top = element.scrollTop;
            element.scrollLeft = left + dx;
            element.scrollTop = top + dy;
            if (element.scrollLeft !== left || element.scrollTop !== top) update(session, x, y);
          }
        }
        session.frame = requestAnimationFrame(tick);
      };
      session.frame = requestAnimationFrame(tick);
    },
    [board, update],
  );

  const onMove = useCallback(
    (event: globalThis.PointerEvent) => {
      const session = sessionRef.current;
      if (session === null || event.pointerId !== session.pointerId || session.cancelled) return;
      if (!session.node.isConnected) return teardown(session);
      if (!session.started) {
        if (latest.current.disabled) return teardown(session);
        if (Math.hypot(event.clientX - session.x, event.clientY - session.y) < SLOP) return;
        session.started = true;
        capturePointer(session.handle, session.pointerId);
        getSelection()?.removeAllRanges();
        window.addEventListener('selectstart', onSelectStart, true);
        mark(session, session.node, 'data-dragging', '');
        const element = board(session);
        if (element !== null) mark(session, element, 'data-dragging', '');
        nodeRef.current = session.node;
        setActive(true);
        scroll(session);
      }
      update(session, event.clientX, event.clientY);
    },
    [board, mark, onSelectStart, scroll, teardown, update],
  );

  const onUp = useCallback(
    (event: globalThis.PointerEvent) => {
      const session = sessionRef.current;
      if (session === null || event.pointerId !== session.pointerId) return;
      if (session.started) quietRef.current = performance.now() + QUIET;
      if (!session.started || session.cancelled || !session.node.isConnected || latest.current.disabled) return teardown(session);
      update(session, event.clientX, event.clientY);
      const change = store.get();
      teardown(session);
      if (change === null) return;
      if (change.kind === 'unassign') {
        if (change.from !== null) latest.current.onDrop(change);
        return;
      }
      if (change.to === null || change.verdict?.level === 'blocked' || samePlace(change.from, change.to)) return;
      latest.current.onDrop(change);
    },
    [store, teardown, update],
  );

  const onCancel = useCallback(
    (event: globalThis.PointerEvent) => {
      const session = sessionRef.current;
      if (session !== null && event.pointerId === session.pointerId) teardown(session);
    },
    [teardown],
  );

  // A click soon after a drop, or the release of a cancelled drag, is the drag's own: it lands on the handle.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // A keyboard or scripted click (detail 0) is never the drag's own.
      if (event.detail === 0 || performance.now() >= quietRef.current) return;
      quietRef.current = 0;
      event.stopPropagation();
      event.preventDefault();
    };
    const onPress = () => {
      quietRef.current = 0;
    };
    window.addEventListener('click', onClick, true);
    window.addEventListener('pointerdown', onPress, true);
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('pointerdown', onPress, true);
    };
  }, []);

  // Capture, so a product's handler that stops these events can't leave a drag running. The listeners
  // stay for the hook's life and return at once without a session.
  useEffect(() => {
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      const session = sessionRef.current;
      if (session !== null) teardown(session);
    };
  }, [onCancel, onMove, onUp, teardown]);

  // The drag takes Escape before a dialog around the board, as does a modal's close request, such as the Android back gesture.
  useEscapeKey(active, true, cancel, nodeRef);

  const parts = { [PARTS]: id };

  const getBoardProps = <P extends object>(props?: P) => ({ ...(props as P), ...parts, [BOARD]: '' });

  const getLaneProps = <P extends object>(lane: string, props?: P) => ({ ...(props as P), ...parts, [LANE]: lane });

  const getQueueProps = <P extends object>(props?: P) => ({ ...(props as P), ...parts, [QUEUE]: '' });

  const getItemProps = <P extends object>(item: string, at: LanePlace | { span: number }, props?: P) =>
    'lane' in at
      ? { ...(props as P), ...parts, [ITEM]: item, [IN]: at.lane, [START]: String(at.start), [END]: String(at.end) }
      : { ...(props as P), ...parts, [ITEM]: item, [SPAN]: String(at.span) };

  const getHandleProps = <P extends UseLaneDragHandleUserProps>(item: string, part: Part, props?: P) => {
    const user = (props ?? {}) as P;
    return {
      ...user,
      onPointerDown: composeHandlers(user.onPointerDown, (event: PointerEvent<HTMLElement>) => {
        if (latest.current.disabled || event.button !== 0) return;
        // A second finger, or a press while a drag runs, starts nothing.
        if (sessionRef.current !== null) {
          if (event.pointerType === 'touch' && !event.isPrimary) return;
          teardown(sessionRef.current);
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
        const session: Session = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          last: { x: event.clientX, y: event.clientY },
          id: item,
          part,
          node,
          handle,
          from,
          span,
          offset: null,
          started: false,
          cancelled: false,
          rtl: new Map(),
          frame: 0,
          marked: new Set(),
        };
        if (part === 'move' && from !== null) {
          const lane = ownLane(session);
          session.offset = lane === null ? 0 : valueAt(session, lane, event.clientX, event.clientY) - from.start;
        }
        sessionRef.current = session;
      }),
    };
  };

  return { getBoardProps, getLaneProps, getQueueProps, getItemProps, getHandleProps, drag };
}
