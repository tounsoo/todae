import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type Ref,
  type RefObject,
} from 'react';
import type { PopoverWire } from './popoverWire.js';
import { useEscapeKey } from './useEscapeKey.js';
import { useFocusRestore } from './useFocusRestore.js';
import { useInitialFocus } from './useInitialFocus.js';
import { composeHandlers, useComposedRefs, useStableComposedRef } from '../internal/props.js';
import { useDomId } from '../internal/domId.js';
import { anchoredContentStyle, anchorTriggerStyle, mergeAnchorNames, removeAnchorName } from './anchorName.js';
import { useControlledState } from '../hooks/useControlledState.js';
import { eventInside } from './eventInside.js';
import { focusWithoutScroll } from '../internal/revealRing.js';
import { aimPopoverOrigin, anchorNamed } from './popoverOrigin.js';

export type { PopoverWire };

export type PopoverCloseReason = 'escape' | 'outside' | 'trigger';

/** What the trigger opens, for `aria-haspopup`. A role-less popover around an OptionList is a listbox. */
export type PopoverHaspopup = 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid';

export type PopoverTriggerUserProps = HTMLAttributes<HTMLElement> & {
  ref?: Ref<HTMLElement | null>;
};

export type PopoverTriggerWire = {
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-haspopup': PopoverHaspopup;
  onClick: (event: MouseEvent<HTMLElement>) => void;
};

export type UsePopoverOptions = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: PopoverCloseReason) => void;
  anchorRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  enabled?: boolean;
  id?: string;
  haspopup?: PopoverHaspopup;
  /**
   * CSS anchor name the popover sits at, set on an element other than the
   * trigger or `anchorRef`, such as a highlighted range in a textarea.
   * Without it, the popover sits at the trigger.
   */
  anchorName?: string | null;
};

export type UsePopoverResult = {
  open: boolean;
  ids: { popover: string };
  triggerRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
  getTriggerProps: <P extends PopoverTriggerUserProps>(props?: P) => P & PopoverTriggerWire;
  getPopoverProps: () => PopoverWire;
};

function stopBubble(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function labelsOf(el: HTMLElement | null): HTMLElement[] {
  const labels = el && 'labels' in el ? (el as HTMLButtonElement).labels : null;
  return labels ? [...labels] : [];
}

/**
 * The engine behind usePopover, Menu, useCombobox, useMentions and Mention's
 * peek. `restoreOnOutside` false skips the outside-click focus return.
 * `initialFocus` false leaves focus where it is when the popover opens, for a
 * peek a hover opened.
 */
export function usePopoverInternal(
  options: UsePopoverOptions,
  restoreOnOutside: boolean,
  initialFocus = true,
): UsePopoverResult {
  const {
    open: openProp,
    defaultOpen,
    onOpenChange,
    anchorRef,
    initialFocusRef,
    restoreFocusRef,
    enabled = true,
    id,
    haspopup = 'dialog',
    anchorName: contentAnchor,
  } = options;
  const [open, setOpen] = useControlledState(openProp, defaultOpen ?? false, onOpenChange);
  const uid = useDomId();
  const contentId = id ?? `todae-popover-${uid}`;
  const anchorName = `--todae-popover-${uid}`;
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const outsideRestore = useRef<(() => void) | null>(null);

  const requestClose = useCallback(
    (reason: PopoverCloseReason) => setOpen(false, reason),
    [setOpen],
  );

  useFocusRestore(enabled && open, { restoreTo: restoreFocusRef, containerRef: popoverRef });
  useInitialFocus(popoverRef, enabled && open && initialFocus, initialFocusRef);
  useEscapeKey(open, enabled, useCallback(() => requestClose('escape'), [requestClose]), popoverRef);

  useLayoutEffect(() => {
    const el = anchorRef?.current;
    if (!el) return;
    const prevName = el.style.getPropertyValue('anchor-name');
    const prevVar = el.style.getPropertyValue('--todae-popover-anchor');
    // Join any anchor name the element already has, such as a tooltip's.
    el.style.setProperty('anchor-name', mergeAnchorNames(prevName, anchorName));
    el.style.setProperty('--todae-popover-anchor', anchorName);
    return () => {
      // Take out only this popover's name: another overlay may have added
      // its own since.
      const rest = removeAnchorName(el.style.getPropertyValue('anchor-name'), anchorName);
      if (rest) el.style.setProperty('anchor-name', rest);
      else el.style.removeProperty('anchor-name');
      // The variable names the last popover anchored here. Hand it back to
      // the one before only if that one is still anchored, and leave it alone
      // if a later popover has taken it.
      if (el.style.getPropertyValue('--todae-popover-anchor') !== anchorName) return;
      const stillAnchored = rest.split(',').some((n) => n.trim() === prevVar);
      if (prevVar && stillAnchored) el.style.setProperty('--todae-popover-anchor', prevVar);
      else el.style.removeProperty('--todae-popover-anchor');
    };
  }, [anchorName, anchorRef]);

  useEffect(() => () => outsideRestore.current?.(), []);

  const wasOpen = useRef(open);
  // The popover grows from where it sits by its anchor as it shows, and
  // shrinks back toward where it sits then as it closes, since it may have
  // flipped while open. Its anchor is its trigger, or the element that
  // carries the name it was placed at, such as a word or a context menu's box.
  // One whose anchor went away as it closed, such as the word a list of
  // suggestions sat by, has nothing to sit by, so it goes at once.
  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const placedAt = el.style.getPropertyValue('--todae-popover-anchor');
    const anchor = placedAt === anchorName ? (anchorRef?.current ?? triggerRef.current) : anchorNamed(el, placedAt);
    const closing = wasOpen.current && !open;
    wasOpen.current = open;
    if (closing && !anchor?.isConnected) el.setAttribute('data-todae-unanchored', '');
    if (anchor?.isConnected) aimPopoverOrigin(el, anchor);
  }, [anchorName, anchorRef, open]);

  useEffect(() => {
    if (!open || !enabled) return;
    function onPointerDown(event: globalThis.PointerEvent) {
      if (eventInside(popoverRef.current, event)) return;
      if (eventInside(triggerRef.current, event)) return;
      if (eventInside(anchorRef?.current ?? null, event)) return;
      // A label's press clicks its trigger, which toggles the popover itself.
      if (labelsOf(triggerRef.current).some((label) => eventInside(label, event))) return;
      requestClose('outside');
      if (!restoreOnOutside) return;
      const trigger = restoreFocusRef?.current ?? triggerRef.current;
      outsideRestore.current?.();
      const finish = () => {
        document.removeEventListener('pointerup', finish, true);
        document.removeEventListener('pointercancel', finish, true);
        outsideRestore.current = null;
        if (openRef.current) return;
        const active = document.activeElement;
        if ((active == null || active === document.body) && trigger) focusWithoutScroll(trigger);
      };
      outsideRestore.current = () => {
        document.removeEventListener('pointerup', finish, true);
        document.removeEventListener('pointercancel', finish, true);
      };
      document.addEventListener('pointerup', finish, true);
      document.addEventListener('pointercancel', finish, true);
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [anchorRef, enabled, open, requestClose, restoreFocusRef, restoreOnOutside]);

  const setTrigger = useComposedRefs(triggerRef);
  const triggerComposed = useStableComposedRef(setTrigger);

  const getTriggerProps = useCallback(
    <P extends PopoverTriggerUserProps>(props?: P): P & PopoverTriggerWire => {
      const user = (props ?? {}) as P;
      return {
        ...user,
        // Stable while the caller's ref is, so the caller's ref is not
        // detached and reattached, and its cleanup kept, across renders.
        ref: triggerComposed(user.ref),
        style: anchorTriggerStyle('--todae-popover-anchor', anchorName, user.style),
        'aria-expanded': open,
        'aria-controls': contentId,
        'aria-haspopup': haspopup,
        onClick: composeHandlers(user.onClick, () => {
          if (enabled) setOpen(!open, 'trigger');
        }),
      };
    },
    [anchorName, contentId, enabled, haspopup, open, setOpen, triggerComposed],
  );

  // Stable, so a part that composes it with its own refs is not detached and
  // reattached on every render.
  const setPopover = useComposedRefs(popoverRef);

  const getPopoverProps = useCallback(
    (): PopoverWire => ({
      id: contentId,
      open,
      ref: setPopover,
      style: anchoredContentStyle('--todae-popover-anchor', contentAnchor ?? anchorName),
      onPointerDown: stopBubble,
      onClick: stopBubble,
    }),
    [anchorName, contentAnchor, contentId, open, setPopover],
  );

  return useMemo(
    () => ({
      open,
      ids: { popover: contentId },
      triggerRef,
      popoverRef,
      getTriggerProps,
      getPopoverProps,
    }),
    [contentId, getPopoverProps, getTriggerProps, open, popoverRef, triggerRef],
  );
}
