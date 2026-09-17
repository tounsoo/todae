import { useEffect, type RefObject } from 'react';

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

export function resolveRelease(input: {
  offset: number;
  velocity: number;
  currentHeight: number;
  heights: { mid: number; full: number };
  snapPoints: readonly SheetSnap[];
  dismissOnDrag: boolean;
}): 'dismiss' | SheetSnap {
  if (input.dismissOnDrag && (input.velocity > 0.5 || input.offset > input.currentHeight * 0.5)) {
    return 'dismiss';
  }
  const projected = input.currentHeight - input.offset - input.velocity * 150;
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

function readPx(el: HTMLElement, name: string): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (raw.endsWith('rem')) return parseFloat(raw) * 16;
  if (raw.endsWith('px')) return parseFloat(raw);
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function sheetHeights(sheet: HTMLElement): { mid: number; full: number } {
  const vh = window.innerHeight;
  const midRatio = readPx(sheet, '--todae-sheet-snap-mid') || 0.5;
  const inset = readPx(sheet, '--todae-sheet-snap-full-inset');
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
  useEffect(() => {
    const root = sheetRef.current;
    if (!root || !enabled) return;
    const sheet = root;

    let pointerId: number | null = null;
    let origin: 'handle' | 'body' | null = null;
    let startY = 0;
    let armed = false;
    const samples: { t: number; y: number }[] = [];

    function setDrag(y: number | null, dragging: boolean) {
      if (!sheet) return;
      sheet.toggleAttribute('data-dragging', dragging);
      if (y == null) sheet.style.removeProperty('--todae-sheet-drag-y');
      else sheet.style.setProperty('--todae-sheet-drag-y', `${y}px`);
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
      const current = heights[snap];
      const maxUp = snap === 'mid' && snapPoints.includes('full') ? current - heights.full : 0;
      const y = Math.min(Math.max(dy, maxUp), current);
      setDrag(y, true);
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
      if (!wasArmed || lastOrigin == null) {
        setDrag(null, false);
        return;
      }
      if (cancelled) {
        setDrag(null, false);
        return;
      }
      const heights = sheetHeights(sheet);
      const current = heights[snap];
      const offset = Number.parseFloat(sheet.style.getPropertyValue('--todae-sheet-drag-y')) || 0;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = first && last ? Math.max(1, last.t - first.t) : 1;
      const velocity = first && last ? (last.y - first.y) / dt : 0;
      const next = resolveRelease({
        offset,
        velocity,
        currentHeight: current,
        heights,
        snapPoints,
        dismissOnDrag,
      });
      setDrag(null, false);
      if (next === 'dismiss') onDismiss();
      else if (next !== snap) onSnap(next);
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
  }, [bodyRef, dismissOnDrag, enabled, onDismiss, onSnap, sheetRef, snap, snapPoints]);
}
