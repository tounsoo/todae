import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';

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
  /** Turn dragging off. */
  disabled?: boolean;
};

export type UseReorderItemProps = {
  draggable: boolean | undefined;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: (event: DragEvent<HTMLElement>) => void;
  'data-dragging'?: '';
  'data-drop'?: ReorderDropPosition;
};

export type UseReorderHandleProps = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
};

export type UseReorderResult = {
  /** The index of the item being dragged, or null. */
  dragging: number | null;
  /** Where the dragged item would land, or null when a drop there would not move it. */
  drop: ReorderDrop | null;
  /** Drag and drop props for each item, by its index. */
  getItemProps: (index: number) => UseReorderItemProps;
  /** Props for the element a drag starts from inside each item, by the item's index. */
  getHandleProps: (index: number) => UseReorderHandleProps;
};

const TYPE = 'application/x-todae-reorder';

/** The index the item at `from` ends at when dropped on `position` of the item at `index`. */
function reorderTarget(from: number, index: number, position: ReorderDropPosition): number {
  const to = position === 'before' ? index : index + 1;
  return to > from ? to - 1 : to;
}

function positionOf(event: DragEvent<HTMLElement>, orientation: 'vertical' | 'horizontal'): ReorderDropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  if (orientation === 'vertical') return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  const left = event.clientX < rect.left + rect.width / 2;
  const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
  return left !== rtl ? 'before' : 'after';
}

export function useReorder({ onMove, orientation = 'vertical', disabled = false }: UseReorderOptions): UseReorderResult {
  // The item a press on its handle may start dragging. Only that item is draggable, so text in the
  // others stays selectable and a drag can't start from anywhere else.
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [drop, setDrop] = useState<ReorderDrop | null>(null);
  // Read by the drag events, which run between renders.
  const draggingRef = useRef<number | null>(null);
  const dropRef = useRef<ReorderDrop | null>(null);

  useEffect(() => {
    if (armed === null || dragging !== null) return;
    const disarm = () => setArmed(null);
    window.addEventListener('pointerup', disarm);
    window.addEventListener('pointercancel', disarm);
    return () => {
      window.removeEventListener('pointerup', disarm);
      window.removeEventListener('pointercancel', disarm);
    };
  }, [armed, dragging]);

  const show = (next: ReorderDrop | null) => {
    dropRef.current = next;
    setDrop((prev) => (prev?.index === next?.index && prev?.position === next?.position ? prev : next));
  };

  const end = () => {
    draggingRef.current = null;
    setDragging(null);
    setArmed(null);
    show(null);
  };

  const over = (event: DragEvent<HTMLElement>, index: number) => {
    const from = draggingRef.current;
    if (from === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const position = positionOf(event, orientation);
    show(reorderTarget(from, index, position) === from ? null : { index, position });
  };

  const getItemProps = (index: number): UseReorderItemProps => ({
    draggable: armed === index && !disabled ? true : undefined,
    onDragStart: (event) => {
      if (armed !== index || disabled) return;
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      // Firefox starts a drag only when it carries data.
      event.dataTransfer.setData(TYPE, String(index));
      draggingRef.current = index;
      setDragging(index);
    },
    onDragEnter: (event) => over(event, index),
    onDragOver: (event) => over(event, index),
    onDragLeave: (event) => {
      if (draggingRef.current === null) return;
      // WebKit fires dragleave on every move inside an item, with no relatedTarget, so ask the
      // pointer instead.
      const rect = event.currentTarget.getBoundingClientRect();
      const { clientX: x, clientY: y } = event;
      if (x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom) return;
      if (dropRef.current?.index === index) show(null);
    },
    onDrop: (event) => {
      const from = draggingRef.current;
      if (from === null) return;
      event.preventDefault();
      const target = dropRef.current;
      end();
      if (target) onMove(from, reorderTarget(from, target.index, target.position));
    },
    onDragEnd: () => {
      if (draggingRef.current !== null || armed !== null) end();
    },
    'data-dragging': dragging === index ? '' : undefined,
    'data-drop': drop?.index === index ? drop.position : undefined,
  });

  const getHandleProps = (index: number): UseReorderHandleProps => ({
    onPointerDown: (event) => {
      if (disabled || event.button !== 0) return;
      setArmed(index);
    },
  });

  return { dragging, drop, getItemProps, getHandleProps };
}
