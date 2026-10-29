import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
import { composeHandlers } from '../components/props.js';
import { useEscapeKey } from '../overlay/useEscapeKey.js';

export type ReorderDropPosition = 'before' | 'after';

export type ReorderDrop = {
  /** The item the dragged one would land beside. */
  index: number;
  /** Which side of that item, in the list's reading order. */
  position: ReorderDropPosition;
};

export type UseReorderOptions = {
  /** Called on a drop that changes the order, with the dragged item's index and the index it ends at. */
  onMove: (from: number, to: number) => void;
  /** The axis the items run along. Default 'vertical'. In a horizontal list, 'before' follows the text direction. */
  orientation?: 'vertical' | 'horizontal';
  /** Turn dragging off. While `disabled` is true, a drag under way can't be dropped. */
  disabled?: boolean;
};

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

export type UseReorderHandleUserProps = {
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLElement>) => void;
};

export type UseReorderHandleProps = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onMouseDown: (event: MouseEvent<HTMLElement>) => void;
};

export type UseReorderResult = {
  /** The index of the item being dragged, or null. */
  dragging: number | null;
  /** Where the dragged item would land, or null when a drop there would not move it. */
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
};

/** The index the item at `from` ends at when dropped on `position` of the item at `index`. */
function reorderTarget(from: number, index: number, position: ReorderDropPosition): number {
  const to = position === 'before' ? index : index + 1;
  return to > from ? to - 1 : to;
}

/** The side of `item` the point x, y is on, in the list's reading order. */
function sideOf(item: Element, x: number, y: number, orientation: 'vertical' | 'horizontal', rtl: boolean): ReorderDropPosition {
  const rect = item.getBoundingClientRect();
  if (orientation === 'vertical') return y < rect.top + rect.height / 2 ? 'before' : 'after';
  const left = x < rect.left + rect.width / 2;
  return left !== rtl ? 'before' : 'after';
}

const INDEX = 'data-todae-reorder-index';
const LIST = 'data-todae-reorder-list';
// How far a finger or pen moves on a handle before its item drags, so a tap doesn't flash a drag.
const SLOP = 4;

/** An item's index now, read from its element, so a list that changes during a drag still moves that item. */
function indexOf(node: HTMLElement): number | null {
  const value = node.getAttribute(INDEX);
  return value === null ? null : Number(value);
}

/**
 * `useReorder({ onMove })` returns `{ dragging, drop, getItemProps, getHandleProps }`, which let a
 * person reorder a list by dragging an item's handle: with the browser's drag and drop for a mouse,
 * and with pointer events for a finger or a pen, since browsers on touch screens differ in whether
 * they drag at all. A drop that changes the order calls `onMove(from, to)`, and Escape cancels a drag. It
 * has no keyboard path: pair it with a way to move an item without dragging, such as a menu.
 */
export function useReorder({ onMove, orientation = 'vertical', disabled = false }: UseReorderOptions): UseReorderResult {
  // One type per list, so a drag from another list, or a file, is never this list's. Types are
  // lowercased, so the id goes in as hex char codes, which keeps ids that differ only in case apart.
  const id = useId();
  const type = `application/x-todae-reorder-${[...id].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`;
  // The item a press on its handle may start dragging. Only that item is draggable, so text in the
  // others stays selectable and a drag of one can't start from anywhere else.
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [drop, setDrop] = useState<ReorderDrop | null>(null);
  // Read by the drag events, which run between renders.
  const sourceRef = useRef<HTMLElement | null>(null);
  // The armed item's element.
  const armedRef = useRef<HTMLElement | null>(null);
  const rtlRef = useRef(false);
  const dropRef = useRef<ReorderDrop | null>(null);
  // A finger or pen on a handle: its pointer and where it went down. A touch drag runs on pointer
  // events, so it never arms the item for the browser's drag.
  const touchRef = useRef<{ id: number; x: number; y: number } | null>(null);
  // The same pointer as state, so a new touch drag that replaces a stale one in one render still
  // listens for its own pointer.
  const [touch, setTouch] = useState<{ id: number; x: number; y: number } | null>(null);
  // Whether the last press on a handle was a finger or pen, whose mousedown, sent after the tap, arms nothing.
  const fingerRef = useRef(false);
  // Read by the touch drag's window listeners.
  const latest = useRef({ onMove, orientation, disabled });
  latest.current = { onMove, orientation, disabled };

  const show = (next: ReorderDrop | null) => {
    dropRef.current = next;
    setDrop((prev) => (prev?.index === next?.index && prev?.position === next?.position ? prev : next));
  };

  const end = useCallback(() => {
    sourceRef.current = null;
    armedRef.current = null;
    dropRef.current = null;
    touchRef.current = null;
    setDragging(null);
    setArmed(null);
    setDrop(null);
    setTouch(null);
  }, []);

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

  // A touch drag: it starts once the finger moves off the press, follows the item under the finger,
  // and drops where the finger lifts. A pointercancel, such as the browser taking the touch to scroll
  // a handle without `touch-action: none`, ends it without a move.
  useEffect(() => {
    const pointer = touch;
    if (pointer === null) return;
    /** Where a drop at x, y lands, or null where it would not move the item. */
    const target = (x: number, y: number): ReorderDrop | null => {
      const node = sourceRef.current;
      const from = node && !latest.current.disabled ? indexOf(node) : null;
      if (from === null) return null;
      const root = node!.getRootNode() as Document | ShadowRoot;
      let item = root.elementFromPoint(x, y)?.closest<HTMLElement>(`[${INDEX}]`) ?? null;
      // An item of a list nested in this one's item isn't this list's.
      while (item && item.getAttribute(LIST) !== node!.getAttribute(LIST)) item = item.parentElement?.closest<HTMLElement>(`[${INDEX}]`) ?? null;
      const index = item ? indexOf(item) : null;
      if (index === null) return null;
      const position = sideOf(item!, x, y, latest.current.orientation, rtlRef.current);
      return reorderTarget(from, index, position) === from ? null : { index, position };
    };
    const move = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointer.id) return;
      const node = sourceRef.current ?? armedRef.current;
      if (node === null || !node.isConnected) return end();
      if (sourceRef.current === null) {
        if (latest.current.disabled) return end();
        if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < SLOP) return;
        sourceRef.current = node;
        rtlRef.current = getComputedStyle(node).direction === 'rtl';
        setDragging(indexOf(node));
      }
      show(target(event.clientX, event.clientY));
    };
    const up = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointer.id) return;
      const node = sourceRef.current;
      const from = node?.isConnected ? indexOf(node) : null;
      const at = from === null ? null : target(event.clientX, event.clientY);
      end();
      if (from !== null && at !== null) latest.current.onMove(from, reorderTarget(from, at.index, at.position));
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
  }, [touch, end]);

  // The browser's drag takes Escape itself and ends with dragend. A touch drag gets it here, before a
  // dialog around the list, as does a modal's close request, such as the Android back gesture.
  useEscapeKey(touch !== null && dragging !== null, true, end, sourceRef);

  const positionOf = (event: DragEvent<HTMLElement>): ReorderDropPosition =>
    sideOf(event.currentTarget, event.clientX, event.clientY, orientation, rtlRef.current);

  /** The dragged item's index, or null when this event isn't a drag this list started and can take. */
  const source = (event: DragEvent<HTMLElement>): number | null => {
    const node = sourceRef.current;
    if (node === null || !event.dataTransfer.types.includes(type)) return null;
    if (!node.isConnected) {
      end();
      return null;
    }
    return disabled ? null : indexOf(node);
  };

  const over = (event: DragEvent<HTMLElement>, index: number) => {
    const from = source(event);
    if (from === null) return show(null);
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const position = positionOf(event);
    show(reorderTarget(from, index, position) === from ? null : { index, position });
  };

  const getItemProps = <P extends UseReorderItemUserProps>(index: number, props?: P) => {
    const user = (props ?? {}) as P;
    return {
      ...user,
      draggable: armed === index && !disabled ? true : undefined,
      onDragStart: composeHandlers(user.onDragStart, (event) => {
        if (armed !== index || disabled) return;
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        // Firefox starts a drag only when it carries data.
        event.dataTransfer.setData(type, String(index));
        sourceRef.current = event.currentTarget;
        rtlRef.current = getComputedStyle(event.currentTarget).direction === 'rtl';
        setDragging(index);
      }),
      onDragEnter: composeHandlers(user.onDragEnter, (event) => over(event, index)),
      onDragOver: composeHandlers(user.onDragOver, (event) => over(event, index)),
      onDragLeave: composeHandlers(user.onDragLeave, (event) => {
        if (sourceRef.current === null) return;
        // WebKit fires dragleave on every move inside an item, with no relatedTarget, so ask the
        // pointer instead. Leaving the window reports 0, 0.
        const rect = event.currentTarget.getBoundingClientRect();
        const { clientX: x, clientY: y } = event;
        const inside = (x !== 0 || y !== 0) && x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
        if (!inside && dropRef.current?.index === index) show(null);
      }),
      onDrop: composeHandlers(user.onDrop, (event) => {
        if (sourceRef.current === null || !event.dataTransfer.types.includes(type)) return;
        const from = source(event);
        event.preventDefault();
        end();
        if (from === null) return;
        const to = reorderTarget(from, index, positionOf(event));
        if (to !== from) onMove(from, to);
      }),
      onDragEnd: composeHandlers(user.onDragEnd, () => {
        if (sourceRef.current !== null || armed !== null) end();
      }),
      [INDEX]: index,
      [LIST]: id,
      'data-dragging': dragging === index ? ('' as const) : undefined,
      'data-drop': drop?.index === index ? drop.position : undefined,
    };
  };

  const getHandleProps = <P extends UseReorderHandleUserProps>(index: number, props?: P) => {
    const user = (props ?? {}) as P;
    return {
      ...user,
      onPointerDown: composeHandlers(user.onPointerDown, (event: PointerEvent<HTMLElement>) => {
        if (disabled || event.button !== 0) return;
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
      }),
      // WebKit sends no pointerdown for the press after a drag, as if the button were still down from
      // it, but it does send mousedown.
      onMouseDown: composeHandlers(user.onMouseDown, (event: MouseEvent<HTMLElement>) => {
        if (disabled || event.button !== 0 || fingerRef.current || touchRef.current !== null || armed === index) return;
        if (sourceRef.current !== null) end();
        const item = event.currentTarget.closest<HTMLElement>(`[${INDEX}]`);
        armedRef.current = item && indexOf(item) === index ? item : null;
        setArmed(index);
      }),
    };
  };

  return { dragging, drop, getItemProps, getHandleProps };
}
