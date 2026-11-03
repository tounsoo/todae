import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import type { MentionPeekContext, MentionSource } from '../mentions/source.js';
import { createIntent, step, type TooltipEvent, type TooltipIntentState } from '../overlay/tooltipIntent.js';
import type { PopoverWire } from '../overlay/popoverWire.js';
import { firstTabbable, getTabbables } from '../overlay/tabbables.js';
import { applyTooltipCommands, readTooltipPolicy } from '../overlay/tooltip.js';
import { usePopoverInternal } from '../overlay/popover.js';

type Phase<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; entity: T }
  | { status: 'missing' };

export type UseMentionPeekOptions<T> = {
  source: MentionSource<T> | null;
  id: string | null;
  /** Default accessible name when `peekLabel` is omitted. */
  text?: string;
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
  /** The peek is a dialog: its content has a focusable control. */
  dialog: boolean;
  label: string;
  /** Passed to `renderPeek`. */
  context: MentionPeekContext;
  close: () => void;
};

function contains(root: HTMLElement | null, node: EventTarget | null): boolean {
  return node instanceof Node && root !== null && root.contains(node);
}

/**
 * The peek of a rendered mention, for `Mention.Root`. Hover or focus opens it
 * after the tooltip delay; a click, or Space on a link, pins it open.
 */
export function useMentionPeek<T>({ source, id, text = '' }: UseMentionPeekOptions<T>): UseMentionPeekResult<T> {
  const triggerRef = useRef<HTMLElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef(false);
  const intentRef = useRef<TooltipIntentState>(createIntent());
  const timerRef = useRef<number | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [phase, setPhase] = useState<Phase<T>>({ status: 'idle' });
  const [dialog, setDialog] = useState(false);
  const hoverOpenRef = useRef(false);
  const pinnedRef = useRef(false);
  hoverOpenRef.current = hoverOpen;
  pinnedRef.current = pinned;

  useEffect(() => {
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
  const shown = hasCard && source?.renderPeek != null && (hoverOpen || pinned);

  const dispatch = useCallback((event: TooltipEvent) => {
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
  }, []);

  const close = useCallback(() => {
    setPinned(false);
    dispatch({ kind: 'escape' });
    setHoverOpen(false);
  }, [dispatch]);

  // Only a pinned peek, opened by a click or Space, moves focus: onto the
  // mention, then into the card, and back to the mention when it closes. A
  // peek that hover or focus opened leaves focus where it is, and returns it
  // only to where it was when the peek opened.
  if (shown) returnTo.current = pinned ? triggerRef.current : null;
  const popover = usePopoverInternal(
    {
      open: shown,
      anchorRef: triggerRef,
      initialFocusRef: triggerRef,
      restoreFocusRef: returnTo,
      onOpenChange: (next) => {
        if (!next) close();
      },
    },
    pinned,
    pinned,
  );

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!shown) {
      setDialog(false);
      return;
    }
    const root = popover.popoverRef.current;
    if (!root) return;
    setDialog(getTabbables(root).length > 0);
  }, [popover.popoverRef, shown, phase]);

  useLayoutEffect(() => {
    if (!pendingFocus.current || !shown) return;
    if (phase.status === 'loading') return;
    const root = popover.popoverRef.current;
    const target = root ? firstTabbable(root) : null;
    if (target) target.focus();
    pendingFocus.current = false;
  }, [phase, popover.popoverRef, shown]);

  const label =
    entity !== undefined && source?.peekLabel ? source.peekLabel(entity) : text;
  const contentId = popover.ids.popover;
  const described = shown && !dialog;

  const peekProps: PeekProps = {
    ...popover.getPopoverProps(),
    onPointerEnter: () => dispatch({ kind: 'acquire', hold: 'hover', reason: 'hover-bridge' }),
    onPointerLeave: (event) => {
      if (contains(triggerRef.current, event.relatedTarget)) return;
      dispatch({ kind: 'release', hold: 'hover', reason: 'hover-bridge' });
    },
  };

  const popoverTrigger = popover.triggerRef;
  const setTrigger = useCallback(
    (node: HTMLElement | null) => {
      triggerRef.current = node;
      popoverTrigger.current = node;
    },
    [popoverTrigger],
  );

  const triggerProps: MentionPeekTriggerProps = {
    ref: setTrigger,
    onPointerEnter: () => {
      dispatch({ kind: 'acquire', hold: 'hover', reason: 'hover' });
    },
    onPointerLeave: (event) => {
      if (contains(popover.popoverRef.current, event.relatedTarget)) return;
      dispatch({ kind: 'release', hold: 'hover' });
    },
    onFocus: () => {
      dispatch({ kind: 'acquire', hold: 'focus', reason: 'focus' });
    },
    onBlur: (event) => {
      if (contains(popover.popoverRef.current, event.relatedTarget)) return;
      dispatch({ kind: 'release', hold: 'focus' });
    },
    onClick: (event) => {
      const href = source?.href?.(id ?? '', entity);
      if (href && event.detail === 0) return;
      if (shown) {
        close();
        return;
      }
      pendingFocus.current = true;
      setPinned(true);
    },
    onKeyDown: (event) => {
      if (event.key === 'Escape' && shown) {
        event.preventDefault();
        close();
        return;
      }
      const href = source?.href?.(id ?? '', entity);
      if (event.key === ' ' && href) {
        event.preventDefault();
        if (shown) close();
        else {
          pendingFocus.current = true;
          setPinned(true);
        }
      }
    },
    'aria-haspopup': dialog ? 'dialog' : undefined,
    'aria-expanded': dialog ? shown : undefined,
    'aria-controls': dialog && shown ? contentId : undefined,
    'aria-describedby': described ? contentId : undefined,
  };

  const context: MentionPeekContext = { id: id ?? '', mode: 'interactive', close };

  return {
    triggerProps,
    peekProps,
    open: shown,
    entity,
    loading,
    dialog,
    label,
    context,
    close,
  };
}
