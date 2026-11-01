import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { MentionPeekContext, MentionSource } from '../mentions/source.js';
import { createIntent, step, type TooltipEvent, type TooltipIntentState } from '../components/Tooltip.intent.js';
import type { PopoverWire } from '../components/Popover.wire.js';
import { firstTabbable, getTabbables } from '../overlay/tabbables.js';
import { applyTooltipCommands, readTooltipPolicy } from './useTooltip.js';
import { usePopover } from './usePopover.js';

type Phase<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; entity: T }
  | { status: 'missing' };

export type UseMentionPeekOptions<T> = {
  source: MentionSource<T> | null;
  id: string | null;
  mode: 'interactive' | 'caret';
  /** Caret peek stays closed while this is false, such as while the suggestion list is open. */
  active?: boolean;
  /** Default accessible name when `peekLabel` is omitted. */
  text?: string;
  /** Element that keeps focus for a caret peek. */
  focusRef?: RefObject<HTMLElement | null>;
  /** CSS anchor name of the token span. The rendered peek anchors to the mention instead. */
  anchorName?: string | null;
};

export type MentionPeekTriggerProps = {
  ref: (node: HTMLElement | null) => void;
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  'aria-haspopup'?: 'dialog';
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  'aria-describedby'?: string;
};

type PeekProps = PopoverWire & {
  onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
};

export type UseMentionPeekResult<T> = {
  triggerProps: MentionPeekTriggerProps;
  peekProps: PeekProps;
  open: boolean;
  entity: T | undefined;
  loading: boolean;
  /** The peek is a dialog. Caret peeks are never dialogs. */
  dialog: boolean;
  label: string;
  /** Passed to `renderPeek`. */
  context: MentionPeekContext;
  close: () => void;
  inert: boolean;
};

function contains(root: HTMLElement | null, node: EventTarget | null): boolean {
  return node instanceof Node && root !== null && root.contains(node);
}

export function useMentionPeek<T>({
  source,
  id,
  mode,
  active = true,
  text = '',
  focusRef,
  anchorName = null,
}: UseMentionPeekOptions<T>): UseMentionPeekResult<T> {
  const triggerRef = useRef<HTMLElement | null>(null);
  const keepFocus = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef(false);
  const intentRef = useRef<TooltipIntentState>(createIntent());
  const timerRef = useRef<number | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase<T>>({ status: 'idle' });
  const [dialog, setDialog] = useState(false);
  const hoverOpenRef = useRef(false);
  const pinnedRef = useRef(false);
  hoverOpenRef.current = hoverOpen;
  pinnedRef.current = pinned;

  useEffect(() => {
    setDismissed(false);
    setPinned(false);
    setHoverOpen(false);
    intentRef.current = createIntent();
  }, [id]);

  useEffect(() => {
    if (!source?.resolve || id == null) {
      setPhase({ status: 'idle' });
      return;
    }
    const ctrl = new AbortController();
    let cancel = false;
    const result = source.resolve(id, ctrl.signal);
    if (result instanceof Promise) {
      setPhase({ status: 'loading' });
      result.then(
        (entity) => {
          if (cancel || ctrl.signal.aborted) return;
          setPhase(entity === undefined ? { status: 'missing' } : { status: 'ready', entity });
        },
        () => {
          if (cancel || ctrl.signal.aborted) return;
          setPhase({ status: 'missing' });
        },
      );
    } else {
      setPhase(result === undefined ? { status: 'missing' } : { status: 'ready', entity: result });
    }
    return () => {
      cancel = true;
      ctrl.abort();
    };
  }, [id, source]);

  const hasCard = phase.status === 'loading' || phase.status === 'ready';
  const entity = phase.status === 'ready' ? phase.entity : undefined;
  const loading = phase.status === 'loading';
  const shown =
    hasCard && source?.renderPeek != null && (mode === 'caret' ? active && !dismissed : hoverOpen || pinned);

  if (mode === 'caret' && focusRef?.current) keepFocus.current = focusRef.current;

  const dispatch = useCallback((event: TooltipEvent) => {
    if (mode !== 'interactive') return;
    const openNow = hoverOpenRef.current || pinnedRef.current;
    const result = step({
      policy: readTooltipPolicy(triggerRef.current, { delayFocus: true }),
      state: intentRef.current,
      open: openNow,
      event,
      restoreFocus: false,
    });
    intentRef.current = result.state;
    applyTooltipCommands(result.commands, timerRef, {
      onElapsed: (token) => dispatch({ kind: 'delay-elapsed', token }),
      commit: (next) => setHoverOpen(next),
      restore: () => {},
    });
  }, [mode]);

  const close = useCallback(() => {
    setPinned(false);
    setDismissed(true);
    dispatch({ kind: 'escape' });
    setHoverOpen(false);
  }, [dispatch]);

  const restoreTo = mode === 'caret' ? focusRef : triggerRef;
  const popover = usePopover({
    open: shown,
    anchorRef: mode === 'interactive' ? triggerRef : undefined,
    initialFocusRef: keepFocus,
    restoreFocusRef: restoreTo,
    onOpenChange: (next) => {
      if (!next) close();
    },
  });

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (mode === 'caret' || !shown) {
      setDialog(false);
      return;
    }
    const root = popover.popoverRef.current;
    if (!root) return;
    setDialog(getTabbables(root).length > 0);
  }, [mode, popover.popoverRef, shown, phase]);

  useLayoutEffect(() => {
    if (!pendingFocus.current || !shown || mode !== 'interactive') return;
    if (phase.status === 'loading') return;
    const root = popover.popoverRef.current;
    const target = root ? firstTabbable(root) : null;
    if (target) target.focus();
    pendingFocus.current = false;
  }, [mode, phase, popover.popoverRef, shown]);

  const label =
    entity !== undefined && source?.peekLabel ? source.peekLabel(entity) : text;
  const contentId = popover.ids.popover;
  const interactiveDialog = mode === 'interactive' && dialog;
  const described = shown && !interactiveDialog;

  const remember = (preferTrigger: boolean) => {
    const activeEl = document.activeElement;
    keepFocus.current =
      !preferTrigger && activeEl instanceof HTMLElement && activeEl !== document.body
        ? activeEl
        : triggerRef.current;
  };

  const wire = popover.getPopoverProps();
  const peekStyle: CSSProperties =
    mode === 'caret' && anchorName
      ? ({
          ...wire.style,
          ['--todae-popover-anchor' as string]: anchorName,
          positionAnchor: anchorName,
        } as CSSProperties)
      : wire.style;

  const peekProps: PeekProps = {
    ...wire,
    style: peekStyle,
    onPointerEnter:
      mode === 'interactive'
        ? () => dispatch({ kind: 'acquire', hold: 'hover', reason: 'hover-bridge' })
        : undefined,
    onPointerLeave:
      mode === 'interactive'
        ? (event) => {
            if (contains(triggerRef.current, event.relatedTarget)) return;
            dispatch({ kind: 'release', hold: 'hover', reason: 'hover-bridge' });
          }
        : undefined,
  };

  const triggerProps: MentionPeekTriggerProps = {
    ref: (node) => {
      triggerRef.current = node;
      if (mode === 'caret' && focusRef) return;
      popover.triggerRef.current = node;
    },
    onPointerEnter: () => {
      if (mode !== 'interactive') return;
      remember(false);
      dispatch({ kind: 'acquire', hold: 'hover', reason: 'hover' });
    },
    onPointerLeave: (event) => {
      if (mode !== 'interactive') return;
      if (contains(popover.popoverRef.current, event.relatedTarget)) return;
      dispatch({ kind: 'release', hold: 'hover' });
    },
    onFocus: () => {
      if (mode !== 'interactive') return;
      remember(true);
      dispatch({ kind: 'acquire', hold: 'focus', reason: 'focus' });
    },
    onBlur: (event) => {
      if (mode !== 'interactive') return;
      if (contains(popover.popoverRef.current, event.relatedTarget)) return;
      dispatch({ kind: 'release', hold: 'focus' });
    },
    onClick: (event) => {
      if (mode !== 'interactive') return;
      const href = source?.href?.(id ?? '', entity);
      if (href && event.detail === 0) return;
      if (shown) {
        close();
        return;
      }
      remember(true);
      pendingFocus.current = true;
      setDismissed(false);
      setPinned(true);
    },
    onKeyDown: (event) => {
      if (event.key === 'Escape' && shown) {
        event.preventDefault();
        close();
        return;
      }
      if (mode !== 'interactive') return;
      const href = source?.href?.(id ?? '', entity);
      if (event.key === ' ' && href) {
        event.preventDefault();
        if (shown) close();
        else {
          remember(true);
          pendingFocus.current = true;
          setDismissed(false);
          setPinned(true);
        }
      }
    },
    'aria-haspopup': interactiveDialog ? 'dialog' : undefined,
    'aria-expanded': interactiveDialog ? shown : undefined,
    'aria-controls': interactiveDialog && shown ? contentId : undefined,
    'aria-describedby': described ? contentId : undefined,
  };

  const context: MentionPeekContext = { id: id ?? '', mode, close };

  return {
    triggerProps,
    peekProps,
    open: shown,
    entity,
    loading,
    dialog: interactiveDialog,
    label,
    context,
    close,
    inert: mode === 'caret',
  };
}
