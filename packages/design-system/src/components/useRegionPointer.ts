import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { eventInside } from '../overlay/eventInside.js';
import { alongside, composeHandlers } from '../internal/props.js';

/** Whether `event` comes from a pointer that hovers: a mouse, or a pen above the screen. */
function hovers(event: ReactPointerEvent): boolean {
  return event.pointerType === 'mouse' || (event.pointerType !== 'touch' && event.buttons === 0);
}

/**
 * Whether a click ends a tap. A click from the keyboard, assistive
 * technology or click() has no detail and names no pointer. One that names
 * a finger or a pen is a tap unless that pen hovers. Otherwise the last
 * press on the region decides: Safari names a finger's click a mouse's.
 */
function isTap(event: ReactMouseEvent, tapPressed: boolean, hoverIds: ReadonlySet<number>): boolean {
  const { pointerType, pointerId } = event.nativeEvent as Partial<PointerEvent>;
  if (event.detail === 0 || pointerType === '') return false;
  if ((pointerType === 'touch' || pointerType === 'pen') && typeof pointerId === 'number') return !hoverIds.has(pointerId);
  return tapPressed;
}

type Handler<E> = ((event: E) => void) | undefined;

/** The consumer's handlers the region's pointer model runs alongside. */
export type RegionPointerHandlers = {
  onPointerEnter?: Handler<ReactPointerEvent<HTMLElement>>;
  onPointerMove?: Handler<ReactPointerEvent<HTMLElement>>;
  onPointerLeave?: Handler<ReactPointerEvent<HTMLElement>>;
  onPointerDown?: Handler<ReactPointerEvent<HTMLElement>>;
  onClickCapture?: Handler<ReactMouseEvent<HTMLElement>>;
  onKeyDown?: Handler<ReactKeyboardEvent<HTMLElement>>;
};

/**
 * The toast region's pointer model. A pointer that hovers spreads the stack
 * while it rests on the region. A tap from a pointer that can't hover, such
 * as a finger, spreads it until a press outside the region or no toast is
 * open, so the toasts behind can be used; it spreads on the tap's click,
 * which the browser has already aimed at what was under the finger. While
 * such a pointer is down on the region, `pressed` holds the timers. Each
 * pointer counts on its own: a mouse can rest on the stack while a finger
 * taps it. `syncHovered` reads hover again a frame later, for a resting
 * pointer that something moved or removed from under it, which sends no
 * pointerleave; it runs by itself when `listKey` changes.
 */
export function useRegionPointer(
  sectionRef: RefObject<HTMLElement | null>,
  { hasOpen, listKey }: { hasOpen: boolean; listKey: string },
  theirs: RegionPointerHandlers,
) {
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [pressed, setPressed] = useState(false);
  const hoverIds = useRef(new Set<number>());
  const pressIds = useRef(new Set<number>());
  // Whether the last press on the region was a tap's, for a click that
  // doesn't say which pointer made it.
  const tapFrom = useRef(false);

  const syncHovered = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;
    const frame = requestAnimationFrame(() => {
      try {
        if (section.matches(':hover')) return;
        hoverIds.current.clear();
        setHovered(false);
      } catch {
        // An engine without :hover keeps what the pointer events said.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [sectionRef]);

  // A toast removed from under a resting pointer sends no pointerleave.
  useLayoutEffect(() => syncHovered(), [listKey, syncHovered]);

  // Nothing left to use, so the next toast starts collapsed and timed.
  if (tapped && !hasOpen) setTapped(false);

  // A press outside ends a tap's spread, and is the last press now.
  useEffect(() => {
    const section = sectionRef.current;
    if (!hasOpen || !section) return;
    const doc = section.ownerDocument;
    const onPointerDown = (event: PointerEvent) => {
      if (eventInside(section, event)) return;
      tapFrom.current = false;
      setTapped(false);
    };
    doc.addEventListener('pointerdown', onPointerDown, true);
    return () => doc.removeEventListener('pointerdown', onPointerDown, true);
  }, [hasOpen, sectionRef]);

  // On the document, as the region misses the release when the toast under
  // the finger is removed. Before the release can come.
  useLayoutEffect(() => {
    const doc = sectionRef.current?.ownerDocument;
    if (!pressed || !doc) return;
    const onEnd = (event: PointerEvent) => {
      pressIds.current.delete(event.pointerId);
      // A press that turns into a scroll sends no click.
      if (event.type === 'pointercancel') tapFrom.current = false;
      if (pressIds.current.size === 0) setPressed(false);
    };
    doc.addEventListener('pointerup', onEnd, true);
    doc.addEventListener('pointercancel', onEnd, true);
    return () => {
      doc.removeEventListener('pointerup', onEnd, true);
      doc.removeEventListener('pointercancel', onEnd, true);
    };
  }, [pressed, sectionRef]);

  const handlers = {
    // A pointer that can't hover, such as a finger, enters on press and
    // leaves on release, which is no hover.
    onPointerEnter: alongside(theirs.onPointerEnter, (event: ReactPointerEvent<HTMLElement>) => {
      if (!hovers(event)) return;
      hoverIds.current.add(event.pointerId);
      setHovered(true);
    }),
    // A pen lifted off the screen over the region hovers from then on.
    onPointerMove: alongside(theirs.onPointerMove, (event: ReactPointerEvent<HTMLElement>) => {
      if (!hovers(event) || hoverIds.current.has(event.pointerId)) return;
      hoverIds.current.add(event.pointerId);
      setHovered(true);
    }),
    onPointerLeave: alongside(theirs.onPointerLeave, (event: ReactPointerEvent<HTMLElement>) => {
      hoverIds.current.delete(event.pointerId);
      setHovered(hoverIds.current.size > 0);
    }),
    onPointerDown: alongside(theirs.onPointerDown, (event: ReactPointerEvent<HTMLElement>) => {
      const tap = event.pointerType !== 'mouse' && !hoverIds.current.has(event.pointerId);
      tapFrom.current = tap;
      if (!tap) return;
      pressIds.current.add(event.pointerId);
      setPressed(true);
    }),
    onClickCapture: alongside(theirs.onClickCapture, (event: ReactMouseEvent<HTMLElement>) => {
      const tapPressed = tapFrom.current;
      tapFrom.current = false;
      if (isTap(event, tapPressed, hoverIds.current)) setTapped(true);
    }),
    // A key press is the last press now, so a later click isn't a tap's.
    onKeyDown: composeHandlers(theirs.onKeyDown, () => {
      tapFrom.current = false;
    }),
  };

  return { spread: hovered || tapped, pressed, syncHovered, handlers };
}
