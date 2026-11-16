import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent, type SyntheticEvent } from 'react';
import { composeHandlers } from '../internal/props.js';
import { useEscapeKey } from '../overlay/useEscapeKey.js';

export type ReorderDropPosition = 'before' | 'after';

export type ReorderDrop = {
  /** The item the dragged one would land beside. In an empty list, 0. */
  index: number;
  /** Which side of that item, in the list's reading order. */
  position: ReorderDropPosition;
};

/** A place in one of a group's lists: the list's key and an index in it. */
export type ReorderPlace<L> = {
  list: L;
  index: number;
};

export type UseReorderGroupOptions<L> = {
  /** Called on a drop that moves an item from one of the group's lists to another, with the list and index it leaves and the list and index it ends at. */
  onMove: (from: ReorderPlace<L>, to: ReorderPlace<L>) => void;
};

declare const groupBrand: unique symbol;

/** Lists that pass the same group to `useReorder` take each other's items. `useReorderGroup` makes one. */
export type ReorderGroup<L> = { readonly [groupBrand]: (list: L) => L };

type Orientation = 'vertical' | 'horizontal';

type ReorderOwnOptions = {
  /** Called on a drop that changes the order, with the dragged item's index and the index it ends at. */
  onMove: (from: number, to: number) => void;
  /** The axis the items run along. Default 'vertical'. In a horizontal list, 'before' follows the text direction. */
  orientation?: Orientation;
  /** Turn dragging off. While `disabled` is true, a drag under way can't be dropped, and the list takes no item from another. */
  disabled?: boolean;
};

export type UseReorderOptions<L = never> = ReorderOwnOptions &
  (
    | { group?: undefined; list?: undefined }
    | {
        /** The group from `useReorderGroup` whose lists take each other's items. */
        group: ReorderGroup<L>;
        /** This list's key, which the group's `onMove` gets as `list`. */
        list: L;
      }
  );

type DragHandler = (event: DragEvent<HTMLElement>) => void;

export type UseReorderItemUserProps = {
  onDragStart?: DragHandler;
  onDragEnter?: DragHandler;
  onDragOver?: DragHandler;
  onDragLeave?: DragHandler;
  onDrop?: DragHandler;
  onDragEnd?: DragHandler;
};

export type UseReorderItemProps = {
  draggable: boolean | undefined;
  onDragStart: DragHandler;
  onDragEnter: DragHandler;
  onDragOver: DragHandler;
  onDragLeave: DragHandler;
  onDrop: DragHandler;
  onDragEnd: DragHandler;
  'data-todae-reorder-index': number;
  'data-todae-reorder-list': string;
  'data-dragging'?: '';
  'data-drop'?: ReorderDropPosition;
};

export type UseReorderListUserProps = {
  onDragEnter?: DragHandler;
  onDragOver?: DragHandler;
  onDragLeave?: DragHandler;
  onDrop?: DragHandler;
};

export type UseReorderListProps = {
  onDragEnter: DragHandler;
  onDragOver: DragHandler;
  onDragLeave: DragHandler;
  onDrop: DragHandler;
  'data-todae-reorder-root': string;
  'data-drop-target'?: '';
};

export type UseReorderHandleUserProps = {
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLElement>) => void;
};

export type UseReorderHandleProps = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onMouseDown: (event: MouseEvent<HTMLElement>) => void;
};

export type UseReorderResult = {
  /** The index of this list's item being dragged, or null. */
  dragging: number | null;
  /** Where the dragged item would land in this list, or null when a drop here would not move it or the drag isn't over this list. */
  drop: ReorderDrop | null;
  /** Drag and drop props for each item, by its index, merged with the caller's own handlers. */
  getItemProps: <P extends UseReorderItemUserProps>(
    index: number,
    props?: P,
  ) => Omit<P, keyof UseReorderItemProps> & UseReorderItemProps;
  /** Props for the element a drag starts from inside each item, by the item's index, merged with the caller's own handler. */
  getHandleProps: <P extends UseReorderHandleUserProps>(
    index: number,
    props?: P,
  ) => Omit<P, keyof UseReorderHandleProps> & UseReorderHandleProps;
  /** Props for the element around the items, so a drop in a gap, past the last item or in an empty list lands in the list too. */
  getListProps: <P extends UseReorderListUserProps>(props?: P) => Omit<P, keyof UseReorderListProps> & UseReorderListProps;
};

/** One list of a group, as the group's other lists and its own handlers see it. Updated after every commit. */
type Member = {
  list: unknown;
  orientation: Orientation;
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  show: (drop: ReorderDrop | null) => void;
  end: () => void;
  /** The armed item's index, read by this list's own handlers. */
  armed: number | null;
};

/** What the lists of a group share. A list with no group has one of its own. */
type Group = {
  /** The drag data type, so a drag from another group, or a file, is never this group's. */
  type: string;
  onMove: ((from: ReorderPlace<unknown>, to: ReorderPlace<unknown>) => void) | null;
  /** The group's lists, by the id on their items. */
  members: Map<string, { current: Member }>;
  /** The drag under way: its item's element and the list it left. */
  drag: { node: HTMLElement; list: string } | null;
  /** The list that shows where the dragged item would land, if any. */
  shown: string | null;
};

/** A drag under way, read when an event needs it: the dragged item's index and its list. */
type Source = { from: number; list: string };

type Locate = (event: DragEvent<HTMLElement>) => ReorderDrop;

type ItemHandlers = Pick<UseReorderItemProps, 'onDragStart' | 'onDragEnter' | 'onDragOver' | 'onDragLeave' | 'onDrop' | 'onDragEnd'>;
type HandleHandlers = UseReorderHandleProps;
type ListHandlers = Pick<UseReorderListProps, 'onDragEnter' | 'onDragOver' | 'onDragLeave' | 'onDrop'>;

/** The caller's handler before ours, or ours alone, which keeps its identity, when the caller has none. */
const compose = <E extends SyntheticEvent>(theirs: ((event: E) => void) | undefined, ours: (event: E) => void) =>
  theirs ? composeHandlers(theirs, ours) : ours;

const INDEX = 'data-todae-reorder-index';
const LIST = 'data-todae-reorder-list';
const ROOT = 'data-todae-reorder-root';
// How far a finger or pen moves on a handle before its item drags, so a tap doesn't flash a drag.
const SLOP = 4;
// Drag events an item or list of a group has taken, so the items and lists around it leave them alone.
const handled = /* @__PURE__ */ new WeakSet<Event>();

// Types are lowercased, so the id goes in as hex char codes, which keeps ids that differ only in case apart.
const typeFor = (id: string) =>
  `application/x-todae-reorder-${[...id].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`;

const createGroup = (type: string, onMove: Group['onMove']): Group => ({ type, onMove, members: new Map(), drag: null, shown: null });

/** The index the item at `from` ends at when dropped on `position` of the item at `index` in its own list. */
function reorderTarget(from: number, index: number, position: ReorderDropPosition): number {
  const to = position === 'before' ? index : index + 1;
  return to > from ? to - 1 : to;
}

/** The side of `item` the point x, y is on, in the list's reading order. */
function sideOf(item: Element, x: number, y: number, orientation: Orientation): ReorderDropPosition {
  const rect = item.getBoundingClientRect();
  if (orientation === 'vertical') return y < rect.top + rect.height / 2 ? 'before' : 'after';
  const left = x < rect.left + rect.width / 2;
  return left !== (getComputedStyle(item).direction === 'rtl') ? 'before' : 'after';
}

/** An item's index now, read from its element, so a list that changes during a drag still moves that item. */
function indexOf(node: Element): number | null {
  const value = node.getAttribute(INDEX);
  return value === null ? null : Number(value);
}

/** Where a drop at x, y in the list `root` lands: before the first of its items the point is before, else after the last. */
function insertion(root: Element, list: string, x: number, y: number, orientation: Orientation): ReorderDrop {
  let last: Element | null = null;
  for (const item of root.querySelectorAll(`[${LIST}]`)) {
    if (item.getAttribute(LIST) !== list) continue;
    if (sideOf(item, x, y, orientation) === 'before') return { index: indexOf(item)!, position: 'before' };
    last = item;
  }
  return last === null ? { index: 0, position: 'before' } : { index: indexOf(last)!, position: 'after' };
}

/** The drop line to show for `at` in `list`, or null where a drop would leave the item where it is. */
function landing(source: Source, list: string, at: ReorderDrop): ReorderDrop | null {
  return list === source.list && reorderTarget(source.from, at.index, at.position) === source.from ? null : at;
}

/** Shows `next` in `list`, and clears the line of any other list of the group. */
function display(group: Group, list: string | null, next: ReorderDrop | null) {
  if (group.shown !== null && group.shown !== list) group.members.get(group.shown)?.current.show(null);
  group.shown = next !== null && list !== null ? list : null;
  if (list !== null) group.members.get(list)?.current.show(next);
}

/** Ends the drag in both lists, then moves the item to `at` in `list`. */
function commit(group: Group, source: Source, list: string, at: ReorderDrop) {
  const from = group.members.get(source.list)?.current;
  const into = group.members.get(list)?.current;
  from?.end();
  into?.end();
  if (from === undefined || into === undefined) return;
  if (list === source.list) {
    const to = reorderTarget(source.from, at.index, at.position);
    if (to !== source.from) from.onMove(source.from, to);
    return;
  }
  const to = at.position === 'before' ? at.index : at.index + 1;
  group.onMove?.({ list: from.list, index: source.from }, { list: into.list, index: to });
}

/** Whether a drag event's pointer is inside its element. Leaving the window reports 0, 0. */
function inside(event: DragEvent<HTMLElement>): boolean {
  const rect = event.currentTarget.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  return (x !== 0 || y !== 0) && x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
}

/**
 * `useReorderGroup({ onMove })` returns a group for `useReorder`. Lists that pass it, each with its
 * own `list` key, take each other's items: a drop in another list of the group calls
 * `onMove(from, to)` with each list's key and index. A drop inside one list still calls that list's own
 * `onMove`.
 */
export function useReorderGroup<L>({ onMove }: UseReorderGroupOptions<L>): ReorderGroup<L> {
  const id = useId();
  // The committed onMove, like each list's, so a render React drops never reaches a drop.
  const latest = useRef(onMove);
  useLayoutEffect(() => {
    latest.current = onMove;
  });
  const [group] = useState(() =>
    createGroup(typeFor(id), (from, to) => latest.current(from as ReorderPlace<L>, to as ReorderPlace<L>)),
  );
  return group as unknown as ReorderGroup<L>;
}

/**
 * `useReorder({ onMove })` returns `{ dragging, drop, getItemProps, getHandleProps, getListProps }`,
 * which let a person reorder a list by dragging an item's handle: with the browser's drag and drop for
 * a mouse, and with pointer events for a finger or a pen, since browsers on touch screens differ in
 * whether they drag at all. A drop that changes the order calls `onMove(from, to)`, and Escape cancels
 * a drag. Lists that share a `group` from `useReorderGroup` also take each other's items. It has no
 * keyboard path: pair it with a way to move an item without dragging, such as a menu.
 */
export function useReorder<L = never>(options: UseReorderOptions<L>): UseReorderResult {
  const { onMove, orientation = 'vertical', disabled = false } = options;
  const id = useId();
  // A list with no group is a group of one, with a drag type of its own.
  const [own] = useState(() => createGroup(typeFor(id), null));
  const group = (options.group as unknown as Group | undefined) ?? own;
  // The item a press on its handle may start dragging. Only that item is draggable, so text in the
  // others stays selectable and a drag of one can't start from anywhere else.
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [drop, setDrop] = useState<ReorderDrop | null>(null);
  // This list's item being dragged, read by the drag events, which run between renders.
  const sourceRef = useRef<HTMLElement | null>(null);
  // The armed item's element.
  const armedRef = useRef<HTMLElement | null>(null);
  const dropRef = useRef<ReorderDrop | null>(null);
  // Written with the member below, once the render commits.
  const groupRef = useRef(group);
  // A finger or pen on a handle: its pointer and where it went down. A touch drag runs on pointer
  // events, so it never arms the item for the browser's drag.
  const touchRef = useRef<{ id: number; x: number; y: number } | null>(null);
  // The same pointer as state, so a new touch drag that replaces a stale one in one render still
  // listens for its own pointer.
  const [touch, setTouch] = useState<{ id: number; x: number; y: number } | null>(null);
  // Whether the last press on a handle was a finger or pen, whose mousedown, sent after the tap, arms nothing.
  const fingerRef = useRef(false);

  const show = useCallback((next: ReorderDrop | null) => {
    dropRef.current = next;
    setDrop((prev) => (prev?.index === next?.index && prev?.position === next?.position ? prev : next));
  }, []);

  const end = useCallback(() => {
    const shared = groupRef.current;
    // The list a drag started from ends it for the whole group, so another list's line goes too.
    if (shared.drag?.list === id) {
      shared.drag = null;
      display(shared, null, null);
    }
    if (shared.shown === id) shared.shown = null;
    sourceRef.current = null;
    armedRef.current = null;
    dropRef.current = null;
    touchRef.current = null;
    setDragging(null);
    setArmed(null);
    setDrop(null);
    setTouch(null);
  }, [id]);

  // This list's committed state and options, read by its handlers, by the group's other lists and by
  // the touch drag's window listeners. The handlers are made once per index and read this, so they keep
  // their identity and a memoized row can skip a render. Written after the commit, so a render React
  // drops never reaches an event; the first render's values stand until then.
  const latest: Member = { list: options.list, orientation, disabled, onMove, show, end, armed };
  const member = useRef(latest);
  useLayoutEffect(() => {
    member.current = latest;
    groupRef.current = group;
  });

  useLayoutEffect(() => {
    group.members.set(id, member);
    return () => {
      group.members.delete(id);
      if (group.shown === id) group.shown = null;
      // A list that goes away mid-drag ends its drag, with any line it left in another list.
      if (group.drag?.list === id) {
        group.drag = null;
        display(group, null, null);
      }
    };
  }, [group, id]);

  // Items that move while armed or dragged keep their state: armed and dragging follow the element,
  // and a removed one ends the drag. It runs after every render, since the items aren't an input, and
  // sets state only when an item moved.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs after every render, since the items are not an input
  useLayoutEffect(() => {
    const node = sourceRef.current ?? armedRef.current;
    if (node === null) return;
    if (!node.isConnected) return end();
    const index = indexOf(node);
    if (index === null) return;
    if (armed !== null && armed !== index) setArmed(index);
    if (sourceRef.current && dragging !== index) setDragging(index);
  });

  useEffect(() => {
    if (armed === null) return;
    // A press that starts no drag ends with pointerup. A drag that starts may send pointercancel,
    // which leaves the item armed once dragstart has run. While a drag runs the page gets no pointer
    // events, so a later pointermove with the dragged item gone from the page means the drag ended
    // without a dragend this list saw. The demo's drag was checked by hand with this in Chromium, Firefox
    // and WebKit.
    const disarm = () => {
      if (sourceRef.current === null) {
        armedRef.current = null;
        setArmed(null);
      }
    };
    const lost = () => {
      if (sourceRef.current && !sourceRef.current.isConnected) end();
    };
    // Capture, as in the touch drag, so a product's handler that stops these can't leave it armed.
    window.addEventListener('pointerup', disarm, true);
    window.addEventListener('pointercancel', disarm, true);
    // WebKit's press after a drag, which arms on mousedown, also ends with mouseup.
    window.addEventListener('mouseup', disarm, true);
    window.addEventListener('pointermove', lost, true);
    return () => {
      window.removeEventListener('pointerup', disarm, true);
      window.removeEventListener('pointercancel', disarm, true);
      window.removeEventListener('mouseup', disarm, true);
      window.removeEventListener('pointermove', lost, true);
    };
  }, [armed, end]);

  // A touch drag: it starts once the finger moves off the press, follows the item or list of the
  // group under the finger, and drops where the finger lifts. A pointercancel, such as the browser
  // taking the touch to scroll a handle without `touch-action: none`, ends it without a move.
  useEffect(() => {
    const pointer = touch;
    if (pointer === null) return;
    /** The drag under way from this list, or null when it can't drop. */
    const from = (): Source | null => {
      const node = sourceRef.current;
      const index = node && !member.current.disabled ? indexOf(node) : null;
      return index === null ? null : { from: index, list: id };
    };
    /** The list of the group under x, y and where in it a drop lands, or null where nothing takes it. */
    const target = (x: number, y: number): { list: string; at: ReorderDrop } | null => {
      const { members } = groupRef.current;
      const dragged = sourceRef.current!;
      const root = dragged.getRootNode() as Document | ShadowRoot;
      // The innermost item or list of this group under the point that takes the item. An item of a
      // list in another group, such as one nested in an item, isn't this group's. A disabled list, or one
      // inside the dragged item, leaves the drop to the list around it, as in the browser's drag.
      for (let node = root.elementFromPoint(x, y); node; node = node.parentElement) {
        const item = node.getAttribute(LIST);
        const list = node.getAttribute(ROOT);
        const key = item !== null && members.has(item) ? item : list !== null && members.has(list) ? list : null;
        if (key === null || (node !== dragged && dragged.contains(node))) continue;
        const into = members.get(key)!.current;
        if (into.disabled) continue;
        const at =
          key === item
            ? { index: indexOf(node)!, position: sideOf(node, x, y, into.orientation) }
            : insertion(node, key, x, y, into.orientation);
        return { list: key, at };
      }
      return null;
    };
    const move = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointer.id) return;
      const node = sourceRef.current ?? armedRef.current;
      if (node === null || !node.isConnected) return end();
      if (sourceRef.current === null) {
        if (member.current.disabled) return end();
        if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < SLOP) return;
        sourceRef.current = node;
        groupRef.current.drag = { node, list: id };
        setDragging(indexOf(node));
      }
      const source = from();
      const over = source && target(event.clientX, event.clientY);
      display(groupRef.current, over?.list ?? null, source && over ? landing(source, over.list, over.at) : null);
    };
    const up = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointer.id) return;
      const source = sourceRef.current?.isConnected ? from() : null;
      const over = source && target(event.clientX, event.clientY);
      if (source && over) commit(groupRef.current, source, over.list, over.at);
      else end();
    };
    const cancel = (event: globalThis.PointerEvent) => {
      if (event.pointerId === pointer.id) end();
    };
    // Capture, so a product's handler that stops these events can't leave the drag running.
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
    };
  }, [touch, end, id]);

  // The browser's drag takes Escape itself and ends with dragend. A touch drag gets it here, before a
  // dialog around the list, as does a modal's close request, such as the Android back gesture.
  useEscapeKey(touch !== null && dragging !== null, true, end, sourceRef);

  /** Clears this list's line, without touching another list's. */
  const hide = () => {
    show(null);
    if (groupRef.current.shown === id) groupRef.current.shown = null;
  };

  /** The group's drag under way, or null when this event isn't one this list can take. */
  const source = (event: DragEvent<HTMLElement>): Source | null => {
    const { disabled } = member.current;
    const group = groupRef.current;
    const drag = group.drag;
    if (drag === null || !event.dataTransfer.types.includes(group.type)) return null;
    // An item can't go into a list inside itself.
    if (drag.node !== event.currentTarget && drag.node.contains(event.currentTarget)) return null;
    const owner = group.members.get(drag.list)?.current;
    if (owner === undefined || !drag.node.isConnected) {
      if (owner) owner.end();
      else group.drag = null;
      return null;
    }
    const from = disabled || owner.disabled ? null : indexOf(drag.node);
    return from === null ? null : { from, list: drag.list };
  };

  // dragenter and dragover, on an item or on the list. The innermost item or list of the group
  // that takes the drag shows where it lands; the ones around it leave the event alone.
  const over = (event: DragEvent<HTMLElement>, locate: Locate) => {
    if (handled.has(event.nativeEvent)) return;
    const from = source(event);
    if (from === null) return hide();
    handled.add(event.nativeEvent);
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    display(groupRef.current, id, landing(from, id, locate(event)));
  };

  const take = (event: DragEvent<HTMLElement>, locate: Locate) => {
    const group = groupRef.current;
    if (handled.has(event.nativeEvent) || group.drag === null || !event.dataTransfer.types.includes(group.type)) return;
    // The drop is the group's own drag, so the browser does nothing else with it, such as open a link.
    event.preventDefault();
    const from = source(event);
    // A list that can't take it, such as one disabled during the drag, leaves it to the list around
    // it. Where none takes it, the drag ends with dragend in its own list.
    if (from === null) return hide();
    handled.add(event.nativeEvent);
    commit(group, from, id, locate(event));
  };

  const itemHandlers = (index: number): ItemHandlers => {
    const locate: Locate = (event) => ({
      index,
      position: sideOf(event.currentTarget, event.clientX, event.clientY, member.current.orientation),
    });
    return {
      onDragStart: (event) => {
        const { armed, disabled } = member.current;
        const group = groupRef.current;
        if (armed !== index || disabled) return;
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        // Firefox starts a drag only when it carries data.
        event.dataTransfer.setData(group.type, String(index));
        sourceRef.current = event.currentTarget;
        group.drag = { node: event.currentTarget, list: id };
        setDragging(index);
      },
      onDragEnter: (event) => over(event, locate),
      onDragOver: (event) => over(event, locate),
      onDragLeave: (event) => {
        // WebKit fires dragleave on every move inside an item, with no relatedTarget, so ask the
        // pointer instead.
        if (groupRef.current.drag !== null && !inside(event) && dropRef.current?.index === index) hide();
      },
      onDrop: (event) => take(event, locate),
      onDragEnd: () => {
        if (sourceRef.current !== null || member.current.armed !== null) end();
      },
    };
  };

  const handleHandlers = (index: number): HandleHandlers => ({
    onPointerDown: (event) => {
      if (member.current.disabled || event.button !== 0) return;
      const finger = event.pointerType === 'touch' || event.pointerType === 'pen';
      // Another finger during a touch drag starts nothing. A primary press, a mouse's, a pen's or a
      // first finger's, means the touch drag's pointerup never came, so that drag is over. A pen and
      // a finger are each primary for their own type, so a palm on a handle ends a pen's drag.
      if (touchRef.current !== null) {
        if (finger && !event.isPrimary) return;
        end();
      }
      fingerRef.current = finger;
      // A drag whose dragend never reached the list is over by now.
      if (sourceRef.current !== null) end();
      const item = event.currentTarget.closest<HTMLElement>(`[${INDEX}]`);
      armedRef.current = item && indexOf(item) === index ? item : null;
      if (fingerRef.current) {
        setArmed(null);
        if (armedRef.current === null) return;
        // No mouse events follow, so a pen dragging across the rows doesn't select their text.
        event.preventDefault();
        touchRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        setTouch(touchRef.current);
        return;
      }
      setArmed(index);
    },
    // WebKit sends no pointerdown for the press after a drag, as if the button were still down from
    // it, but it does send mousedown.
    onMouseDown: (event) => {
      if (member.current.disabled || event.button !== 0 || fingerRef.current || touchRef.current !== null) return;
      if (member.current.armed === index) return;
      if (sourceRef.current !== null) end();
      const item = event.currentTarget.closest<HTMLElement>(`[${INDEX}]`);
      armedRef.current = item && indexOf(item) === index ? item : null;
      setArmed(index);
    },
  });

  // Each index's handlers, made on first use and kept, so the functions above run as the render that
  // first asked for them made them: they read the drag through refs and stable callbacks only, never a
  // value of a later render. The list's handlers are made once.
  const [handlers] = useState(() => ({
    items: new Map<number, ItemHandlers>(),
    handles: new Map<number, HandleHandlers>(),
    list: null as ListHandlers | null,
  }));
  const ownItem = (index: number) => {
    let own = handlers.items.get(index);
    if (own === undefined) handlers.items.set(index, (own = itemHandlers(index)));
    return own;
  };
  const ownHandle = (index: number) => {
    let own = handlers.handles.get(index);
    if (own === undefined) handlers.handles.set(index, (own = handleHandlers(index)));
    return own;
  };
  // A drag over the list but not over one of its items, such as in a gap, past the last item or in an
  // empty list, lands by the pointer among the items.
  const ownList = () =>
    (handlers.list ??= ((locate: Locate): ListHandlers => ({
      onDragEnter: (event) => over(event, locate),
      onDragOver: (event) => over(event, locate),
      onDragLeave: (event) => {
        if (groupRef.current.drag !== null && !inside(event)) hide();
      },
      onDrop: (event) => take(event, locate),
    }))((event) => insertion(event.currentTarget, id, event.clientX, event.clientY, member.current.orientation)));

  // The item and list getters are this render's, as their props carry its state. The handlers in them
  // keep their identity.
  const getItemProps = <P extends UseReorderItemUserProps>(index: number, props?: P) => {
    const user = (props ?? {}) as P;
    const own = ownItem(index);
    return {
      ...user,
      draggable: armed === index && !disabled ? true : undefined,
      onDragStart: compose(user.onDragStart, own.onDragStart),
      onDragEnter: compose(user.onDragEnter, own.onDragEnter),
      onDragOver: compose(user.onDragOver, own.onDragOver),
      onDragLeave: compose(user.onDragLeave, own.onDragLeave),
      onDrop: compose(user.onDrop, own.onDrop),
      onDragEnd: compose(user.onDragEnd, own.onDragEnd),
      [INDEX]: index,
      [LIST]: id,
      'data-dragging': dragging === index ? ('' as const) : undefined,
      'data-drop': drop?.index === index ? drop.position : undefined,
    };
  };

  const getListProps = <P extends UseReorderListUserProps>(props?: P) => {
    const user = (props ?? {}) as P;
    const own = ownList();
    return {
      ...user,
      onDragEnter: compose(user.onDragEnter, own.onDragEnter),
      onDragOver: compose(user.onDragOver, own.onDragOver),
      onDragLeave: compose(user.onDragLeave, own.onDragLeave),
      onDrop: compose(user.onDrop, own.onDrop),
      [ROOT]: id,
      'data-drop-target': drop !== null ? ('' as const) : undefined,
    };
  };

  // The handle's props carry no state, so this getter keeps its identity too.
  const getHandleProps = useCallback(<P extends UseReorderHandleUserProps>(index: number, props?: P) => {
    const own = ownHandle(index);
    // With no props of the caller's, the same object every time, so a row can take it as one prop.
    if (props === undefined) return own as Omit<P, keyof UseReorderHandleProps> & UseReorderHandleProps;
    return {
      ...props,
      onPointerDown: compose(props.onPointerDown, own.onPointerDown),
      onMouseDown: compose(props.onMouseDown, own.onMouseDown),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ownHandle hands out handlers made once per index, which read state through refs
  }, []);

  return { dragging, drop, getItemProps, getHandleProps, getListProps };
}

