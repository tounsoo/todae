import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import { useDomId } from '../internal/domId.js';
import { warnOnce } from '../internal/warnOnce.js';
import { mergeAnchorNames, removeAnchorName } from './anchorName.js';
import { eventInside } from './eventInside.js';
import { holds, inertOutside } from './inertOutside.js';
import { aimPopoverOrigin } from './popoverOrigin.js';
import { getTabbables, GUEST_LAYER_ATTRIBUTE } from './tabbables.js';
import { useControlledOpen, type OverlayCloseReason } from './useControlledOpen.js';
import { useEscapeKey } from './useEscapeKey.js';
import { useFocusRestore } from './useFocusRestore.js';
import { focusWithoutScroll } from '../internal/revealRing.js';
import { initialFocusTarget } from './useInitialFocus.js';
import { useRefElement } from './useRefElement.js';

/** Why a coachmark asked to close: Escape, a press on the dim page, or its close part. */
export type CoachmarkCloseReason = Extract<OverlayCloseReason, 'escape' | 'backdrop' | 'close-button'>;

export type UseCoachmarkOptions = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: CoachmarkCloseReason) => void;
  targetRef: RefObject<HTMLElement | null>;
  dismissOnEscape: boolean;
  dismissOnBackdrop: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * The elements the target opens, by its `aria-controls`, such as a menu: they
 * stay usable beside it. One in a popover or dialog of its own, such as a
 * combobox's listbox in its popover or sheet, brings that whole surface, so
 * the search field, status and handle beside it stay usable too.
 */
function controlledBy(target: HTMLElement): HTMLElement[] {
  const ids = (target.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean);
  const doc = target.ownerDocument;
  return ids
    .map((id) => doc.getElementById(id))
    .filter((el): el is HTMLElement => el !== null)
    .map((el) => {
      const surface = el.closest<HTMLElement>('[popover], dialog');
      return surface && !holds(surface, target) ? surface : el;
    });
}

/** The target and the tab stops inside it, in document order. */
function targetStops(target: HTMLElement): HTMLElement[] {
  const parent = target.parentElement;
  if (!parent) return [];
  return getTabbables(parent).filter((el) => el === target || target.contains(el));
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The hole's corners: the target's own, grown by the hole's padding, so a
 * pill button gets a pill hole. `--_pad` is the scrim sheet's padding.
 */
export function cutoutCorners(target: HTMLElement): Record<string, string> {
  const style = getComputedStyle(target);
  const corners: Record<string, string> = {};
  for (const corner of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'] as const) {
    const value = style[corner] || '0px';
    corners[corner] = value
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `calc(${part} + var(--_pad))`)
      .join(' ');
  }
  return corners;
}

/**
 * The engine behind Coachmark.Root: one element, `targetRef`, stays usable
 * while the rest of the page is inert, and a popup points at it. Focus moves
 * into the popup as it opens, Tab cycles through the popup and the target,
 * and focus goes back where it was as it closes. Escape and, with
 * `dismissOnBackdrop`, a press on the dim page ask to close.
 */
export function useCoachmark({
  open: openProp,
  defaultOpen,
  onOpenChange: onOpenChangeProp,
  targetRef,
  dismissOnEscape,
  dismissOnBackdrop,
  initialFocusRef,
  restoreFocusRef,
}: UseCoachmarkOptions) {
  const [open, onOpenChange] = useControlledState<boolean, [reason: CoachmarkCloseReason]>(
    openProp,
    defaultOpen ?? false,
    onOpenChangeProp,
  );
  const { requestClose } = useControlledOpen({ open, onOpenChange });
  const uid = useDomId();
  const popupId = `todae-coachmark-${uid}`;
  const anchorName = `--todae-coachmark-${uid}`;
  const popupRef = useRef<HTMLElement | null>(null);
  const scrimRef = useRef<HTMLElement | null>(null);
  // The element, not the ref, so a target that remounts or a tour's next
  // step moves the anchor, the hole and the inert page with it.
  const target = useRefElement(targetRef);

  // A tour's next step slides the popup and the hole to the new target, by
  // layout, as the Tabs indicator slides: data-todae-moving turns on the
  // transitions of their anchored edges until they end. It is set before the
  // anchor name moves, so the style that moves them already holds the
  // transitions. Opening, closing and reduced motion move nothing.
  const shown = useRef<{ open: boolean; target: HTMLElement | null }>({ open: false, target: null });
  useLayoutEffect(() => {
    const last = shown.current;
    shown.current = { open, target: target ?? last.target };
    if (!open || !last.open || !target || !last.target || last.target === target || reducedMotion()) return;
    const parts = [popupRef.current, scrimRef.current].filter((el): el is HTMLElement => el != null);
    for (const el of parts) el.setAttribute('data-todae-moving', '');
    let done = false;
    // Two frames on, once a layout has resolved the new anchor and started
    // the slide, wait for what runs; a browser that slides nothing ends it then.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const running = parts.flatMap((el) => el.getAnimations?.() ?? []);
        void Promise.all(running.map((animation) => animation.finished.catch(() => undefined))).then(() => {
          if (done) return;
          for (const el of parts) el.removeAttribute('data-todae-moving');
        });
      });
    });
    return () => {
      done = true;
      cancelAnimationFrame(frame);
      for (const el of parts) el.removeAttribute('data-todae-moving');
    };
  }, [open, target]);

  // The target carries the anchor name the popup and the hole sit at, beside
  // any name it has already, such as its own tooltip's. It keeps it while
  // closed, so the popup and the hole stay put as they fade out.
  useLayoutEffect(() => {
    if (!target) return;
    target.style.setProperty('anchor-name', mergeAnchorNames(target.style.getPropertyValue('anchor-name'), anchorName));
    return () => {
      const rest = removeAnchorName(target.style.getPropertyValue('anchor-name'), anchorName);
      if (rest) target.style.setProperty('anchor-name', rest);
      else target.style.removeProperty('anchor-name');
    };
  }, [anchorName, target]);

  // Records where focus was before anything below moves it.
  useFocusRestore(open, { restoreTo: restoreFocusRef, containerRef: popupRef });

  // Everything but the target, what it opens, the popup and the hole is inert
  // while it is open. The target is brought into view, and the hole takes its
  // corners. Focus that the inert page took, such as on a step's old target,
  // moves into the popup.
  useLayoutEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    const scrim = scrimRef.current;
    if (!target) {
      // On the commit that mounts an open coachmark, the element arrives a
      // render later; warn only when the ref holds nothing either.
      if (!targetRef.current && process.env.NODE_ENV !== 'production') {
        warnOnce('coachmark-target', 'Todae: Coachmark.Root opened with no element in targetRef, so it has nothing to point at.');
      }
      return;
    }
    target.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: reducedMotion() ? 'instant' : 'smooth' });
    if (scrim) Object.assign(scrim.style, cutoutCorners(target));
    const keep = () => [target, ...controlledBy(target), popup, scrim].filter((el): el is HTMLElement => el != null);
    let release = inertOutside(keep);
    // What the target controls can mount later, as a combobox's listbox does
    // when its popover first opens and names it in aria-controls: keep it too.
    const controls = new MutationObserver(() => {
      release();
      release = inertOutside(keep);
    });
    controls.observe(target, { attributes: true, attributeFilter: ['aria-controls'] });
    const active = target.ownerDocument.activeElement;
    if (popup && active instanceof HTMLElement && (active === target.ownerDocument.body || active.closest('[inert]'))) {
      focusWithoutScroll(initialFocusTarget(popup, initialFocusRef));
    }
    return () => {
      controls.disconnect();
      release();
    };
  }, [initialFocusRef, open, target, targetRef]);

  // Focus moves in as it opens, without scrolling the page, so it doesn't cut
  // short the target's scroll into view.
  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (open && popup) focusWithoutScroll(initialFocusTarget(popup, initialFocusRef));
    // initialFocusRef is read as it opens only, so a tour's step keeps focus where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read as it opens only
  }, [open]);

  // The popup grows out of the side of the target it sits by.
  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (open && popup && target) aimPopoverOrigin(popup, target);
  }, [open, target]);

  useEscapeKey(open, dismissOnEscape, useCallback(() => requestClose('escape'), [requestClose]), popupRef);

  // Tab and Shift+Tab go round the popup's tab stops, then the target's.
  // Focus in something the target opened, such as its menu, is that layer's.
  useEffect(() => {
    if (!open) return;
    const doc = popupRef.current?.ownerDocument ?? document;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const popup = popupRef.current;
      const target = targetRef.current;
      if (!popup) return;
      const cycle = [...getTabbables(popup), ...(target ? targetStops(target) : [])];
      if (cycle.length === 0) return;
      const active = doc.activeElement;
      const at = active instanceof HTMLElement ? cycle.indexOf(active) : -1;
      if (at === -1 && active instanceof HTMLElement && active !== doc.body && !popup.contains(active) && !target?.contains(active)) {
        if (active.closest('[inert]') === null) return;
      }
      event.preventDefault();
      const step = event.shiftKey ? -1 : 1;
      const next = at === -1 ? (event.shiftKey ? cycle[cycle.length - 1] : cycle[0]) : cycle[(at + step + cycle.length) % cycle.length];
      next?.focus();
    }
    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, [open, targetRef]);

  // A press on the dim page, outside the target, the popup and what the
  // target opened, asks to close when the owner allows it.
  useEffect(() => {
    if (!open || !dismissOnBackdrop) return;
    const doc = popupRef.current?.ownerDocument ?? document;
    function onPointerDown(event: PointerEvent) {
      const target = targetRef.current;
      if (eventInside(popupRef.current, event) || eventInside(target, event)) return;
      if (target && controlledBy(target).some((el) => eventInside(el, event))) return;
      const at = event.target;
      if (at instanceof Element && at.closest(`[${GUEST_LAYER_ATTRIBUTE}]`)) return;
      requestClose('backdrop');
    }
    doc.addEventListener('pointerdown', onPointerDown, true);
    return () => doc.removeEventListener('pointerdown', onPointerDown, true);
  }, [dismissOnBackdrop, open, requestClose, targetRef]);

  return { open, requestClose, popupId, anchorName, popupRef, scrimRef };
}
