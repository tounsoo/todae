import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type HTMLAttributes,
  type PointerEvent,
  type Ref,
  type RefObject,
} from 'react';
import {
  createIntent,
  step,
  type TooltipCommand,
  type TooltipEvent,
  type TooltipOpenReason,
  type TooltipPolicy,
} from '../components/Tooltip.intent.js';
import type { TooltipWire } from '../components/Tooltip.wire.js';
import { firstTabbable } from '../overlay/tabbables.js';
import { useEscapeKey } from '../overlay/useEscapeKey.js';
import { composeHandlers, useComposedRefs, useStableComposedRef } from '../components/props.js';
import { useDomId } from '../components/domId.js';
import { anchorTriggerStyle } from '../overlay/anchorName.js';
import { tokenMs } from '../overlay/cssTime.js';
import { useControlledState } from './useControlledState.js';

export type { TooltipOpenReason, TooltipWire };

export type TooltipTriggerUserProps = HTMLAttributes<HTMLElement> & {
  ref?: Ref<HTMLElement | null>;
};

export type TooltipTriggerWire = {
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
  'aria-describedby'?: string;
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
};

export type UseTooltipOptions<I extends boolean = false> = {
  interactive?: I;
  showDelay?: number;
  hideDelay?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: TooltipOpenReason) => void;
  enabled?: boolean;
  id?: string;
};

/**
 * Options for Todae's own parts, not exported from the package. `anchorName`
 * is the CSS anchor name the trigger and tip share, for a trigger that sets it
 * itself. `holdsFocus` also holds the tip while an element it accepts has
 * focus, such as an element around the trigger.
 */
export type TooltipInternalOptions = {
  anchorName?: string;
  holdsFocus?: (focused: Element) => boolean;
  /** Focus waits for the show delay. Tooltips leave this off. */
  delayFocus?: boolean;
};

/** Hover holds for a trigger that wires its own pointer handlers. */
export type TooltipInternalResult = {
  holdHover: () => void;
  releaseHover: (relatedTarget: EventTarget | null) => void;
};

export type UseTooltipResult<I extends boolean = false> = {
  open: boolean;
  interactive: I;
  ids: { tooltip: string };
  triggerRef: RefObject<HTMLElement | null>;
  tooltipRef: RefObject<HTMLElement | null>;
  getTriggerProps: <P extends TooltipTriggerUserProps>(props?: P) => P & TooltipTriggerWire;
  getTooltipProps: () => TooltipWire<I>;
};

// For when the delay tokens can't be read, such as without Todae's stylesheet.
const SHOW_DELAY_MS = 300;
const HIDE_DELAY_MS = 100;

/** The delay policy a tooltip or a mention peek reads from the trigger. */
export function readTooltipPolicy(
  node: Element | null,
  options: { showDelay?: number; hideDelay?: number; delayFocus?: boolean } = {},
): TooltipPolicy {
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  return {
    fidelity: coarse ? 'coarse' : 'fine',
    showDelayMs: options.showDelay ?? tokenMs(node, '--todae-tooltip-delay-show') ?? SHOW_DELAY_MS,
    hideDelayMs: options.hideDelay ?? tokenMs(node, '--todae-tooltip-delay-hide') ?? HIDE_DELAY_MS,
    delayFocus: options.delayFocus,
  };
}

/** Runs one step's commands. The delay timer lives here so a peek does not keep its own. */
export function applyTooltipCommands(
  commands: readonly TooltipCommand[],
  timerRef: { current: number | null },
  effects: {
    onElapsed: (token: number) => void;
    commit: (open: boolean, reason: TooltipOpenReason) => void;
    restore: () => void;
  },
): void {
  for (const command of commands) {
    switch (command.kind) {
      case 'clear-delay':
        if (timerRef.current != null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        break;
      case 'start-delay':
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          effects.onElapsed(command.token);
        }, command.ms);
        break;
      case 'commit':
        effects.commit(command.open, command.reason);
        break;
      case 'restore-trigger-focus':
        effects.restore();
        break;
      default: {
        const _exhaustive: never = command;
        void _exhaustive;
      }
    }
  }
}

/** `ids` with `id` added at the end, unless it already lists it. */
function joinId(ids: string | undefined, id: string): string {
  const list = ids?.split(/\s+/).filter(Boolean) ?? [];
  return list.includes(id) ? list.join(' ') : [...list, id].join(' ');
}

function tooltipStyle(anchorName: string): CSSProperties {
  return {
    ['--todae-tooltip-anchor' as string]: anchorName,
    positionAnchor: anchorName,
  } as CSSProperties;
}

export function useTooltip<I extends boolean = false>(
  options: UseTooltipOptions<I> = {} as UseTooltipOptions<I>,
): UseTooltipResult<I> {
  // Internal options come in a second argument, which this never passes.
  const { holdHover: _holdHover, releaseHover: _releaseHover, ...result } = useTooltipInternal(options);
  return result;
}

/** useTooltip with the options and holds of {@link TooltipInternalOptions} and {@link TooltipInternalResult}. */
export function useTooltipInternal<I extends boolean = false>(
  options: UseTooltipOptions<I> = {} as UseTooltipOptions<I>,
  internal: TooltipInternalOptions = {},
): UseTooltipResult<I> & TooltipInternalResult {
  const { anchorName: anchorNameOption, holdsFocus, delayFocus = false } = internal;
  const {
    interactive = false as I,
    showDelay,
    hideDelay,
    open: openProp,
    defaultOpen,
    onOpenChange,
    enabled = true,
    id,
  } = options;
  const [open, setValue] = useControlledState(openProp, defaultOpen ?? false);
  const [restoreEpoch, setRestoreEpoch] = useState(0);
  const uid = useDomId();
  const contentId = id ?? `todae-tooltip-${uid}`;
  const anchorName = anchorNameOption ?? `--todae-tooltip-${uid}`;
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLElement | null>(null);
  const intentRef = useRef(createIntent());
  const timerRef = useRef<number | null>(null);
  const openRef = useRef(open);
  const onOpenChangeRef = useRef(onOpenChange);
  const showDelayRef = useRef(showDelay);
  const hideDelayRef = useRef(hideDelay);
  const delayFocusRef = useRef(delayFocus);
  const enabledRef = useRef(enabled);
  const holdsFocusRef = useRef(holdsFocus);
  const dispatchRef = useRef<(event: TooltipEvent, restoreFocus?: boolean) => void>(() => undefined);
  openRef.current = open;
  onOpenChangeRef.current = onOpenChange;
  showDelayRef.current = showDelay;
  hideDelayRef.current = hideDelay;
  delayFocusRef.current = delayFocus;
  enabledRef.current = enabled;
  holdsFocusRef.current = holdsFocus;

  const applyCommands = useCallback(
    (commands: readonly TooltipCommand[]) => {
      applyTooltipCommands(commands, timerRef, {
        onElapsed: (token) => dispatchRef.current({ kind: 'delay-elapsed', token }),
        commit: (open, reason) => {
          setValue(open);
          onOpenChangeRef.current?.(open, reason);
        },
        restore: () => setRestoreEpoch((epoch) => epoch + 1),
      });
    },
    [setValue],
  );

  const dispatch = useCallback(
    (event: TooltipEvent, restoreFocus = false) => {
      if (!enabledRef.current && event.kind !== 'delay-elapsed') return;
      const result = step({
        policy: readTooltipPolicy(triggerRef.current, {
          showDelay: showDelayRef.current,
          hideDelay: hideDelayRef.current,
          delayFocus: delayFocusRef.current,
        }),
        state: intentRef.current,
        open: openRef.current,
        event,
        restoreFocus,
      });
      intentRef.current = result.state;
      applyCommands(result.commands);
    },
    [applyCommands],
  );
  dispatchRef.current = dispatch;

  const pairContains = useCallback((node: EventTarget | null) => {
    if (!(node instanceof Node)) return false;
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    return Boolean((trigger && trigger.contains(node)) || (tooltip && tooltip.contains(node)));
  }, []);

  // Whether `node` is an element that `holdsFocus` accepts.
  const holderAccepts = useCallback(
    (node: EventTarget | null) => node instanceof Element && holdsFocusRef.current?.(node) === true,
    [],
  );

  useEffect(() => {
    if (enabled) return;
    intentRef.current = createIntent();
    applyCommands([{ kind: 'clear-delay' }]);
    if (openRef.current) {
      setValue(false);
      onOpenChangeRef.current?.(false, 'escape');
    }
  }, [applyCommands, enabled, setValue]);

  const onEscape = useCallback(() => {
    const tooltip = tooltipRef.current;
    const active = document.activeElement;
    const restoreFocus = Boolean(tooltip && active instanceof Node && tooltip.contains(active));
    dispatch({ kind: 'escape' }, restoreFocus);
  }, [dispatch]);

  useEscapeKey(open, enabled, onEscape, tooltipRef, { closeRequests: false });

  useLayoutEffect(() => {
    if (restoreEpoch === 0 || open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    (firstTabbable(trigger) ?? trigger).focus();
  }, [open, restoreEpoch]);

  useEffect(() => {
    if (!open || !enabled) return;
    function onFocusIn(event: globalThis.FocusEvent) {
      if (pairContains(event.target) || holderAccepts(event.composedPath()[0] ?? null)) return;
      dispatch({ kind: 'release', hold: 'focus' });
    }
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [dispatch, enabled, holderAccepts, open, pairContains]);

  // Focus on an element that holdsFocus accepts holds the tip as focus on the
  // trigger does. The element itself is the composed path's first entry, so
  // one inside a shadow root counts. Only a focusin acquires, so a tip never
  // opens without the person moving focus, and the hold ends when focus
  // leaves that element, even if holdsFocus no longer accepts it by then.
  const hasHolder = holdsFocus !== undefined;
  useEffect(() => {
    if (!enabled || !hasHolder) return;
    const doc = triggerRef.current?.ownerDocument ?? document;
    let held: EventTarget | null = null;
    function onFocusIn(event: globalThis.FocusEvent) {
      const focused = event.composedPath()[0] ?? null;
      if (!holderAccepts(focused)) return;
      held = focused;
      dispatch({ kind: 'acquire', hold: 'focus', reason: 'focus' });
    }
    function onFocusOut(event: globalThis.FocusEvent) {
      if (held === null || event.composedPath()[0] !== held) return;
      if (holderAccepts(event.relatedTarget) || pairContains(event.relatedTarget)) return;
      held = null;
      dispatch({ kind: 'release', hold: 'focus' });
    }
    doc.addEventListener('focusin', onFocusIn);
    doc.addEventListener('focusout', onFocusOut);
    return () => {
      doc.removeEventListener('focusin', onFocusIn);
      doc.removeEventListener('focusout', onFocusOut);
    };
  }, [dispatch, enabled, hasHolder, holderAccepts, pairContains]);

  // dispatch ignores holds while the tip is not enabled.
  const holdHover = useCallback(() => dispatch({ kind: 'acquire', hold: 'hover', reason: 'hover' }), [dispatch]);
  const releaseHover = useCallback(
    (relatedTarget: EventTarget | null) => {
      if (!pairContains(relatedTarget)) dispatch({ kind: 'release', hold: 'hover' });
    },
    [dispatch, pairContains],
  );

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const setTrigger = useComposedRefs(triggerRef);
  const triggerComposed = useStableComposedRef(setTrigger);

  const getTriggerProps = useCallback(
    <P extends TooltipTriggerUserProps>(props?: P): P & TooltipTriggerWire => {
      const user = (props ?? {}) as P;
      return {
        ...user,
        // Stable while the caller's ref is; see usePopover.
        ref: triggerComposed(user.ref),
        style: anchorTriggerStyle('--todae-tooltip-anchor', anchorName, user.style),
        'aria-describedby': open && enabled ? joinId(user['aria-describedby'], contentId) : user['aria-describedby'],
        onPointerEnter: composeHandlers(user.onPointerEnter, holdHover),
        // Releases run even when the consumer's handler prevents the event,
        // so a prevented leave or blur cannot strand the tip open.
        onPointerLeave: (event: PointerEvent<HTMLElement>) => {
          user.onPointerLeave?.(event);
          releaseHover(event.relatedTarget);
        },
        onFocus: composeHandlers(user.onFocus, () => {
          if (enabled) dispatch({ kind: 'acquire', hold: 'focus', reason: 'focus' });
        }),
        onBlur: (event: FocusEvent<HTMLElement>) => {
          user.onBlur?.(event);
          if (enabled && !pairContains(event.relatedTarget) && !holderAccepts(event.relatedTarget)) {
            dispatch({ kind: 'release', hold: 'focus' });
          }
        },
      };
    },
    [anchorName, contentId, dispatch, enabled, holdHover, holderAccepts, open, pairContains, releaseHover, triggerComposed],
  );

  const setTooltip = useComposedRefs(tooltipRef);
  const getTooltipProps = useCallback((): TooltipWire<I> => {
    const wire = {
      id: contentId,
      open,
      interactive,
      ref: setTooltip,
      style: tooltipStyle(anchorName),
    };
    if (!interactive) return wire as TooltipWire<I>;
    return {
      ...wire,
      onPointerEnter: () => {
        if (enabled) dispatch({ kind: 'acquire', hold: 'hover', reason: 'hover-bridge' });
      },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        if (enabled && !pairContains(event.relatedTarget)) {
          dispatch({ kind: 'release', hold: 'hover', reason: 'hover-bridge' });
        }
      },
    } as TooltipWire<I>;
  }, [anchorName, contentId, dispatch, enabled, interactive, open, pairContains, setTooltip]);

  return {
    open,
    interactive,
    ids: { tooltip: contentId },
    triggerRef,
    tooltipRef,
    getTriggerProps,
    getTooltipProps,
    holdHover,
    releaseHover,
  };
}
