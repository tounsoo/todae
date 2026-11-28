// The one place that reads a mouse or pen over parts drawn on a scroller's
// edges, such as ScrollEdges' arrows. A native scrollbar may lie over those
// parts and take the pointer from them, so listening on the parts alone
// misses it. On a Mac, WebKit's overlay scrollbar sends the moves over it to
// the scroller rather than to the part drawn there (#533), and a press there
// drags the scrollbar, which holds the mouse and sends no move or leave until
// it lets go (#534). `todae/scroller-pointer` fails a pointer listener on an
// element that scrolls a scroller anywhere else, so new parts come here.

// Where each mouse or pen was before its latest move, per window, so a part
// can tell a pointer moving onto it from one it showed up under. Not every
// browser reports movementX and movementY for every move, so this is the
// fallback. It listens in the capture phase, before any part of the page can
// stop the event, and keeps the place before the move the part sees. Touch
// is left out, so a finger elsewhere says nothing about where a mouse rests.
type Point = { x: number; y: number; before: { x: number; y: number } | null };
const points = new WeakMap<Window, Map<number, Point>>();
function watchPointer(win: Window) {
  if (points.has(win)) return;
  const byPointer = new Map<number, Point>();
  points.set(win, byPointer);
  win.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      const last = byPointer.get(event.pointerId);
      byPointer.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        before: last ? { x: last.x, y: last.y } : null,
      });
    },
    { capture: true, passive: true },
  );
}
function moved(event: PointerEvent, win: Window): boolean {
  if (event.movementX || event.movementY) return true;
  // A pointer never seen before this move has no place to compare with.
  const before = points.get(win)?.get(event.pointerId)?.before;
  if (!before) return false;
  return Math.abs(event.clientX - before.x) >= 0.5 || Math.abs(event.clientY - before.y) >= 0.5;
}

export type ScrollerPartsListener = {
  /** Whether a part shows now. A hidden part takes no pointer. */
  shown: (part: HTMLElement) => boolean;
  /**
   * A mouse or pen with no button held moved onto a shown part: over the
   * part itself, or over the scroller where a scrollbar lies over the part.
   * A part that shows up under a still pointer hears nothing.
   */
  rest: (part: HTMLElement) => void;
  /**
   * The pointer left the parts, or went to the scroller's own scrollbar,
   * whose drag holds the mouse from then until it lets go.
   */
  leave: () => void;
};

/**
 * Watches a mouse or pen over `parts`, drawn on the edges of `scroller` (its
 * descendants), and returns a function that stops. Touch is ignored, and a
 * press on a part is cancelled, so it neither focuses the scroller nor closes
 * what it sits in.
 */
export function watchScrollerParts(scroller: HTMLElement, parts: readonly HTMLElement[], listener: ScrollerPartsListener): () => void {
  const win = scroller.ownerDocument.defaultView ?? window;
  watchPointer(win);
  const isPart = (node: EventTarget | null) => parts.some((part) => part.contains(node as Node));

  const enter = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !moved(event, win)) return;
    listener.rest(event.currentTarget as HTMLElement);
  };
  // A scrollbar that takes no room, as macOS draws them, lies over the parts
  // at the scroller's edge, and WebKit sends a move over it to the scroller
  // rather than to the part drawn there. So a move that reaches the scroller
  // itself counts by the shown part under the pointer. A later part paints
  // over an earlier one where two meet in a corner, so the search runs from
  // the last.
  const under = (event: PointerEvent): HTMLElement | undefined =>
    [...parts].reverse().find((part) => {
      if (!listener.shown(part)) return false;
      const box = part.getBoundingClientRect();
      return event.clientX >= box.left && event.clientX < box.right && event.clientY >= box.top && event.clientY < box.bottom;
    });
  // A move with a button held is a drag, as of the scrollbar's thumb, and
  // never starts a part; one already resting keeps on.
  const over = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || isPart(event.target)) return;
    const part = event.target === scroller ? under(event) : undefined;
    if (!part) listener.leave();
    else if (!event.buttons && moved(event, win)) listener.rest(part);
  };
  // Leaving a part for that band of the scroller has not left the part.
  const leave = (event: PointerEvent) => {
    if (event.relatedTarget === scroller && under(event) === event.currentTarget) return;
    listener.leave();
  };
  const press = (event: Event) => event.preventDefault();
  // A press that reaches the scroller itself is on its scrollbar, which then
  // holds the mouse: WebKit sends no move or leave until it lets go. So a
  // part the pointer started on the way to the thumb leaves here, rather
  // than pull against the drag.
  const grab = (event: PointerEvent) => {
    if (event.target === scroller) listener.leave();
  };
  const stop = () => listener.leave();

  for (const part of parts) {
    part.addEventListener('pointermove', enter as EventListener);
    part.addEventListener('pointerleave', leave as EventListener);
    part.addEventListener('pointerdown', press);
    part.addEventListener('mousedown', press);
  }
  scroller.addEventListener('pointermove', over, { passive: true });
  scroller.addEventListener('pointerleave', stop);
  scroller.addEventListener('pointerdown', grab);
  return () => {
    scroller.removeEventListener('pointermove', over);
    scroller.removeEventListener('pointerleave', stop);
    scroller.removeEventListener('pointerdown', grab);
    for (const part of parts) {
      part.removeEventListener('pointermove', enter as EventListener);
      part.removeEventListener('pointerleave', leave as EventListener);
      part.removeEventListener('pointerdown', press);
      part.removeEventListener('mousedown', press);
    }
  };
}
