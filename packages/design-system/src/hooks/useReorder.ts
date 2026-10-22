import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { composeHandlers } from '../components/props.js';

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
  'data-dragging'?: '';
  'data-drop'?: ReorderDropPosition;
};

export type UseReorderHandleUserProps = {
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
};

export type UseReorderHandleProps = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
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

const INDEX = 'data-todae-reorder-index';

/** An item's index now, read from its element, so a list that changes during a drag still moves that item. */
function indexOf(node: HTMLElement): number | null {
  const value = node.getAttribute(INDEX);
  return value === null ? null : Number(value);
}

/**
 * `useReorder({ onMove })` returns `{ dragging, drop, getItemProps, getHandleProps }`, which let a
 * person reorder a list by dragging an item's handle, with the browser's drag and drop. A drop that
 * changes the order calls `onMove(from, to)`. It has no keyboard path: pair it with a way to move an
 * item without dragging, such as a menu.
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

  const show = (next: ReorderDrop | null) => {
    dropRef.current = next;
    setDrop((prev) => (prev?.index === next?.index && prev?.position === next?.position ? prev : next));
  };

  const end = useCallback(() => {
    sourceRef.current = null;
    armedRef.current = null;
    dropRef.current = null;
    setDragging(null);
    setArmed(null);
    setDrop(null);
  }, []);

  // Items that move while armed or dragged keep their state: armed and dragging follow the element,
  // and a removed one ends the drag. It runs after every render, since the items aren't an input, and
  // sets state only when an item moved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    window.addEventListener('pointerup', disarm);
    window.addEventListener('pointercancel', disarm);
    window.addEventListener('pointermove', lost);
    return () => {
      window.removeEventListener('pointerup', disarm);
      window.removeEventListener('pointercancel', disarm);
      window.removeEventListener('pointermove', lost);
    };
  }, [armed, end]);

  const positionOf = (event: DragEvent<HTMLElement>): ReorderDropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (orientation === 'vertical') return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    const left = event.clientX < rect.left + rect.width / 2;
    return left !== rtlRef.current ? 'before' : 'after';
  };

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
        // A drag whose dragend never reached the list is over by now.
        if (sourceRef.current !== null) end();
        const item = event.currentTarget.closest<HTMLElement>(`[${INDEX}]`);
        armedRef.current = item && indexOf(item) === index ? item : null;
        setArmed(index);
      }),
    };
  };

  return { dragging, drop, getItemProps, getHandleProps };
}
