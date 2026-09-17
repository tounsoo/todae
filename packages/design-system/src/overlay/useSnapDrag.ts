import { useEffect, useRef, type RefObject } from 'react';

export type SheetSnap = 'mid' | 'full';

export function dragOrigin(input: {
  fromHandle: boolean;
  inBody: boolean;
  scrollTop: number;
}): 'handle' | 'body' | null {
  if (input.fromHandle) return 'handle';
  if (input.inBody && input.scrollTop === 0) return 'body';
  return null;
}

export function dragHeight(startHeight: number, pointerDeltaY: number, maxHeight: number): number {
  return Math.min(Math.max(startHeight - pointerDeltaY, 0), maxHeight);
}

export function resolveRelease(input: {
  height: number;
  velocity: number;
  heights: { mid: number; full: number };
  snapPoints: readonly SheetSnap[];
  dismissOnDrag: boolean;
}): 'dismiss' | SheetSnap {
  const projected = input.height - input.velocity * 150;
  if (input.dismissOnDrag) {
    const pulled = input.heights.mid - input.height;
    if (input.velocity > 0 && pulled >= input.heights.mid * 0.3) return 'dismiss';
    if (projected < input.heights.mid * 0.5) return 'dismiss';
  }
  let best: SheetSnap = input.snapPoints[0] ?? 'mid';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const snap of input.snapPoints) {
    const dist = Math.abs(projected - input.heights[snap]);
    if (dist < bestDist) {
      best = snap;
      bestDist = dist;
    }
  }
  return best;
}

function readPx(el: HTMLElement, name: string, vh: number): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (raw.endsWith('rem')) return parseFloat(raw) * 16;
  if (raw.endsWith('px')) return parseFloat(raw);
  if (raw.endsWith('vh') || raw.endsWith('dvh')) return (parseFloat(raw) / 100) * vh;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function sheetHeights(sheet: HTMLElement): { mid: number; full: number } {
  const vh = window.innerHeight;
  const midRatio = readPx(sheet, '--todae-sheet-snap-mid', vh) || 0.5;
  const inset = readPx(sheet, '--todae-sheet-snap-full-inset', vh);
  return { mid: midRatio * vh, full: Math.max(0, vh - inset) };
}

export function useSnapDrag({
  sheetRef,
  bodyRef,
  snap,
  snapPoints,
  onSnap,
  onDismiss,
  enabled,
  dismissOnDrag,
}: {
  sheetRef: RefObject<HTMLElement | null>;
  bodyRef: RefObject<HTMLElement | null>;
  snap: SheetSnap;
  snapPoints: readonly SheetSnap[];
  onSnap: (snap: SheetSnap) => void;
  onDismiss: () => void;
  enabled: boolean;
  dismissOnDrag: boolean;
}): void {
  const snapRef = useRef(snap);
  const pointsRef = useRef(snapPoints);
  const onSnapRef = useRef(onSnap);
  const onDismissRef = useRef(onDismiss);
  const dismissRef = useRef(dismissOnDrag);
  snapRef.current = snap;
  pointsRef.current = snapPoints;
  onSnapRef.current = onSnap;
  onDismissRef.current = onDismiss;
  dismissRef.current = dismissOnDrag;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !enabled) return;
    const root = sheet.parentElement;

    let pointerId: number | null = null;
    let origin: 'handle' | 'body' | null = null;
    let startY = 0;
    let startHeight = 0;
    let armed = false;
    const samples: { t: number; y: number }[] = [];

    function setDrag(height: number | null, dragging: boolean) {
      sheet.toggleAttribute('data-dragging', dragging);
      root?.toggleAttribute('data-dragging', dragging);
      if (height == null) {
        sheet.style.removeProperty('--todae-sheet-drag-height');
        root?.style.removeProperty('--todae-sheet-scrim-progress');
        return;
      }
      sheet.style.setProperty('--todae-sheet-drag-height', `${height}px`);
      const heights = sheetHeights(sheet);
      const progress = height >= heights.mid ? 1 : Math.max(0, height / heights.mid);
      root?.style.setProperty('--todae-sheet-scrim-progress', String(progress));
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0 || pointerId != null) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const fromHandle = Boolean(target.closest('[data-sheet-drag-handle]'));
      const interactive = target.closest('button, a, input, select, textarea');
      if (interactive && !fromHandle) return;
      const body = bodyRef.current;
      const inBody = Boolean(body && body.contains(target));
      origin = dragOrigin({ fromHandle, inBody, scrollTop: body?.scrollTop ?? 0 });
      if (!origin) return;
      pointerId = event.pointerId;
      startY = event.clientY;
      const heights = sheetHeights(sheet);
      const measured = sheet.getBoundingClientRect().height;
      startHeight = measured > 0 ? measured : heights[snapRef.current];
      armed = false;
      samples.length = 0;
      samples.push({ t: event.timeStamp, y: event.clientY });
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerId !== pointerId || origin == null) return;
      const dy = event.clientY - startY;
      if (!armed) {
        if (Math.abs(dy) <= 6) return;
        if (origin === 'body' && dy <= 0) {
          pointerId = null;
          origin = null;
          return;
        }
        armed = true;
        try {
          sheet.setPointerCapture(event.pointerId);
        } catch {
          undefined;
        }
      }
      const heights = sheetHeights(sheet);
      const maxHeight = pointsRef.current.includes('full') ? heights.full : heights.mid;
      setDrag(dragHeight(startHeight, dy, maxHeight), true);
      samples.push({ t: event.timeStamp, y: event.clientY });
      while (samples.length > 1 && event.timeStamp - samples[0]!.t > 100) samples.shift();
    }

    function finish(event: PointerEvent, cancelled: boolean) {
      if (event.pointerId !== pointerId) return;
      const wasArmed = armed;
      const lastOrigin = origin;
      pointerId = null;
      origin = null;
      armed = false;
      if (!wasArmed || lastOrigin == null || cancelled) {
        setDrag(null, false);
        return;
      }
      const heights = sheetHeights(sheet);
      const height =
        Number.parseFloat(sheet.style.getPropertyValue('--todae-sheet-drag-height')) || startHeight;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = first && last ? Math.max(1, last.t - first.t) : 1;
      const velocity = first && last ? (last.y - first.y) / dt : 0;
      const next = resolveRelease({
        height,
        velocity,
        heights,
        snapPoints: pointsRef.current,
        dismissOnDrag: dismissRef.current,
      });
      setDrag(height, false);
      if (next === 'dismiss') {
        onDismissRef.current();
        return;
      }
      if (next !== snapRef.current) onSnapRef.current(next);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!sheet.isConnected) return;
          sheet.style.removeProperty('--todae-sheet-drag-height');
        });
      });
    }

    function onPointerUp(event: PointerEvent) {
      finish(event, false);
    }

    function onPointerCancel(event: PointerEvent) {
      finish(event, true);
    }

    function onTouchMove(event: TouchEvent) {
      if (!armed) return;
      event.preventDefault();
    }

    sheet.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    sheet.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      sheet.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      sheet.removeEventListener('touchmove', onTouchMove);
      setDrag(null, false);
    };
  }, [bodyRef, enabled, sheetRef]);
}
