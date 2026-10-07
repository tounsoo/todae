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
} from '../components/Tooltip.intent';
import type { TooltipWire } from '../components/Tooltip.wire';
import { getTabbables } from '../overlay/tabbables';
import { useEscapeKey } from '../overlay/useEscapeKey';
import { useComposedRefs, useStableComposedRef } from '../components/props';
import { useDomId } from '../components/domId';
import { anchorTriggerStyle } from '../overlay/anchorName';
import { useControlledState } from './useControlledState';

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

export type UseTooltipResult<I extends boolean = false> = {
  open: boolean;
  interactive: I;
  ids: { tooltip: string };
  triggerRef: RefObject<HTMLElement | null>;
  tooltipRef: RefObject<HTMLElement | null>;
  getTriggerProps: <P extends TooltipTriggerUserProps>(props?: P) => P & TooltipTriggerWire;
  getTooltipProps: () => TooltipWire<I>;
};

function tooltipStyle(anchorName: string): CSSProperties {
  return {
    ['--todae-tooltip-anchor' as string]: anchorName,
    positionAnchor: anchorName,
  } as CSSProperties;
}

export function useTooltip<I extends boolean = false>(
  options: UseTooltipOptions<I> = {} as UseTooltipOptions<I>,
): UseTooltipResult<I> {
  const {
    interactive = false as I,
    showDelay = 300,
    hideDelay = 100,
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
  const anchorName = `--todae-tooltip-${uid}`;
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLElement | null>(null);
  const intentRef = useRef(createIntent());
  const timerRef = useRef<number | null>(null);
  const openRef = useRef(open);
  const onOpenChangeRef = useRef(onOpenChange);
  const showDelayRef = useRef(showDelay);
  const hideDelayRef = useRef(hideDelay);
  const enabledRef = useRef(enabled);
  const dispatchRef = useRef<(event: TooltipEvent, restoreFocus?: boolean) => void>(() => undefined);
  openRef.current = open;
  onOpenChangeRef.current = onOpenChange;
  showDelayRef.current = showDelay;
  hideDelayRef.current = hideDelay;
  enabledRef.current = enabled;

  const applyCommands = useCallback(
    (commands: readonly TooltipCommand[]) => {
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
              dispatchRef.current({ kind: 'delay-elapsed', token: command.token });
            }, command.ms);
            break;
          case 'commit':
            setValue(command.open);
            onOpenChangeRef.current?.(command.open, command.reason);
            break;
          case 'restore-trigger-focus':
            setRestoreEpoch((epoch) => epoch + 1);
            break;
          default: {
            const _exhaustive: never = command;
            void _exhaustive;
          }
        }
      }
    },
    [setValue],
  );

  const dispatch = useCallback(
    (event: TooltipEvent, restoreFocus = false) => {
      if (!enabledRef.current && event.kind !== 'delay-elapsed') return;
      const fidelity = window.matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine';
      const result = step({
        policy: {
          fidelity,
          showDelayMs: showDelayRef.current,
          hideDelayMs: hideDelayRef.current,
        },
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

  useEscapeKey(open, enabled, onEscape, tooltipRef);

  useLayoutEffect(() => {
    if (restoreEpoch === 0 || open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    (getTabbables(trigger)[0] ?? trigger).focus();
  }, [open, restoreEpoch]);

  useEffect(() => {
    if (!open || !enabled) return;
    function onFocusIn(event: globalThis.FocusEvent) {
      if (pairContains(event.target)) return;
      dispatch({ kind: 'release', hold: 'focus' });
    }
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [dispatch, enabled, open, pairContains]);

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
        'aria-describedby': open && enabled ? contentId : user['aria-describedby'],
        onPointerEnter: (event: PointerEvent<HTMLElement>) => {
          user.onPointerEnter?.(event);
          if (enabled) dispatch({ kind: 'acquire', hold: 'hover', reason: 'hover' });
        },
        onPointerLeave: (event: PointerEvent<HTMLElement>) => {
          user.onPointerLeave?.(event);
          if (enabled && !pairContains(event.relatedTarget)) {
            dispatch({ kind: 'release', hold: 'hover' });
          }
        },
        onFocus: (event: FocusEvent<HTMLElement>) => {
          user.onFocus?.(event);
          if (enabled) dispatch({ kind: 'acquire', hold: 'focus', reason: 'focus' });
        },
        onBlur: (event: FocusEvent<HTMLElement>) => {
          user.onBlur?.(event);
          if (enabled && !pairContains(event.relatedTarget)) {
            dispatch({ kind: 'release', hold: 'focus' });
          }
        },
      };
    },
    [anchorName, contentId, dispatch, enabled, open, pairContains, triggerComposed],
  );

  const getTooltipProps = useCallback((): TooltipWire<I> => {
    const wire = {
      id: contentId,
      open,
      interactive,
      ref: (node: HTMLElement | null) => {
        tooltipRef.current = node;
      },
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
  }, [anchorName, contentId, dispatch, enabled, interactive, open, pairContains]);

  return {
    open,
    interactive,
    ids: { tooltip: contentId },
    triggerRef,
    tooltipRef,
    getTriggerProps,
    getTooltipProps,
  };
}
