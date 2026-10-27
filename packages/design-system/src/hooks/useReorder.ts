import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
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
  // Whether the browser has sent drag or dragover since dragstart, which shows the drag is running.
  const liveRef = useRef(false);
  // The pointer type of the press that armed the item.
  const pressRef = useRef('');
  // When the last touch on an armed item lifted, so the mousedown a tap sends after it doesn't arm.
  const touchUpRef = useRef(-Infinity);
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
    // A press that starts no drag ends with pointerup, or mouseup for one armed by mousedown. A drag
    // that starts may send pointercancel, which leaves the item armed once dragstart has run. A
    // running drag fires drag on its item or dragover where it is, every few hundred milliseconds or
    // sooner, and the page gets no pointer events while it runs (checked in Chromium, Firefox and
    // WebKit). So a pointerup, or a pointermove with no button down, ends a drag that has had
    // neither event within half a second, as a Chromium touch drag that starts with no drag session
    // needs; a running drag goes on, so a drop after a lift still lands. A mouse drag that ran ends
    // on a pointermove with no button down, since its button is up. A pointermove with the dragged
    // item gone from the page ends any drag, since a removed item gets no dragend.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      const node = sourceRef.current;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (sourceRef.current === node && !liveRef.current) end();
      }, 500);
    };
    const disarm = () => {
      if (sourceRef.current === null) {
        armedRef.current = null;
        setArmed(null);
      }
    };
    const up = (event: globalThis.PointerEvent) => {
      if (event.pointerType === 'touch') touchUpRef.current = event.timeStamp;
      if (sourceRef.current === null) disarm();
      else if (!liveRef.current) settle();
    };
    const lost = (event: globalThis.PointerEvent) => {
      const node = sourceRef.current;
      if (node === null) return;
      if (!node.isConnected || (liveRef.current && event.buttons === 0 && pressRef.current === 'mouse')) end();
      else if (!liveRef.current && event.buttons === 0) settle();
    };
    const live = () => {
      if (sourceRef.current) liveRef.current = true;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('mouseup', disarm);
    window.addEventListener('pointercancel', disarm);
    window.addEventListener('pointermove', lost);
    window.addEventListener('drag', live, true);
    window.addEventListener('dragover', live, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('mouseup', disarm);
      window.removeEventListener('pointercancel', disarm);
      window.removeEventListener('pointermove', lost);
      window.removeEventListener('drag', live, true);
      window.removeEventListener('dragover', live, true);
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
        liveRef.current = false;
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
    const arm = (event: MouseEvent<HTMLElement>, pointerType: string) => {
      if (disabled || event.button !== 0) return;
      pressRef.current = pointerType;
      // A drag whose dragend never reached the list is over by now.
      if (sourceRef.current !== null) end();
      const item = event.currentTarget.closest<HTMLElement>(`[${INDEX}]`);
      armedRef.current = item && indexOf(item) === index ? item : null;
      setArmed(index);
    };
    return {
      ...user,
      onPointerDown: composeHandlers(user.onPointerDown, (event: PointerEvent<HTMLElement>) => arm(event, event.pointerType)),
      // WebKit sends no pointerdown for the first press after a drop, only mousedown, so that press
      // arms the item too. A pointerdown that is prevented sends no mousedown, and the mousedown a
      // touch tap sends after its pointerup, within a second of the lift, arms nothing.
      onMouseDown: composeHandlers(user.onMouseDown, (event: MouseEvent<HTMLElement>) => {
        if (event.timeStamp - touchUpRef.current >= 1000) arm(event, 'mouse');
      }),
    };
  };

  return { dragging, drop, getItemProps, getHandleProps };
}
