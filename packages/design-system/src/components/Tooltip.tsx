import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import { useControlledState } from '../hooks/useControlledState';
import { getTabbables } from '../overlay/tabbables';
import { useEscapeKey } from '../overlay/useEscapeKey';
import { usePopoverSync } from '../overlay/usePopoverSync';
import {
  createIntent,
  step,
  type TooltipCommand,
  type TooltipEvent,
  type TooltipOpenReason,
} from './Tooltip.intent';
import {
  contentPolicyError,
  isMounted,
  resolveSurface,
  type PanelSurface,
  type TipSurface,
} from './Tooltip.surface';
import styles from './Tooltip.module.css';

export type { TooltipOpenReason };

export type TooltipProps = {
  interactive?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: TooltipOpenReason) => void;
  showDelay?: number;
  hideDelay?: number;
  children: ReactNode;
};

export type TooltipTriggerProps = {
  children: ReactNode;
};

export type TooltipContentProps = Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'popover' | 'tabIndex' | 'id'>;

type TooltipContextValue = {
  open: boolean;
  interactive: boolean;
  contentId: string;
  anchorName: string;
  triggerRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  dispatch: (event: TooltipEvent, restoreFocus?: boolean) => void;
  pairContains: (node: EventTarget | null) => boolean;
};

const TooltipContext = createContext<TooltipContextValue | null>(null);

function useTooltip(): TooltipContextValue {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error('Tooltip parts must render inside Tooltip');
  return ctx;
}

function triggerStyle(anchorName: string): CSSProperties {
  return {
    ['--todae-tooltip-anchor' as string]: anchorName,
    anchorName,
  } as CSSProperties;
}

function contentStyle(anchorName: string, style?: CSSProperties): CSSProperties {
  return {
    ...style,
    ['--todae-tooltip-anchor' as string]: anchorName,
    positionAnchor: anchorName,
  } as CSSProperties;
}

export function Tooltip({
  interactive = false,
  open: openProp,
  defaultOpen,
  onOpenChange,
  showDelay = 300,
  hideDelay = 100,
  children,
}: TooltipProps) {
  const [open, setValue] = useControlledState(openProp, defaultOpen ?? false);
  const uid = useId().replaceAll(':', '');
  const contentId = `todae-tooltip-${uid}`;
  const anchorName = `--todae-tooltip-${uid}`;
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const intentRef = useRef(createIntent());
  const timerRef = useRef<number | null>(null);
  const openRef = useRef(open);
  const onOpenChangeRef = useRef(onOpenChange);
  const showDelayRef = useRef(showDelay);
  const hideDelayRef = useRef(hideDelay);
  const dispatchRef = useRef<(event: TooltipEvent, restoreFocus?: boolean) => void>(() => undefined);
  openRef.current = open;
  onOpenChangeRef.current = onOpenChange;
  showDelayRef.current = showDelay;
  hideDelayRef.current = hideDelay;

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
          case 'restore-trigger-focus': {
            const trigger = triggerRef.current;
            if (!trigger) break;
            (getTabbables(trigger)[0] ?? trigger).focus();
            break;
          }
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
    const content = contentRef.current;
    return Boolean((trigger && trigger.contains(node)) || (content && content.contains(node)));
  }, []);

  const onEscape = useCallback(() => {
    const content = contentRef.current;
    const active = document.activeElement;
    const restoreFocus = Boolean(content && active instanceof Node && content.contains(active));
    dispatch({ kind: 'escape' }, restoreFocus);
  }, [dispatch]);

  useEscapeKey(open, true, onEscape);

  useEffect(() => {
    if (!open) return;
    function onFocusIn(event: FocusEvent) {
      if (pairContains(event.target)) return;
      dispatch({ kind: 'release', hold: 'focus' });
    }
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [dispatch, open, pairContains]);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const ctx = useMemo<TooltipContextValue>(
    () => ({
      open,
      interactive,
      contentId,
      anchorName,
      triggerRef,
      contentRef,
      dispatch,
      pairContains,
    }),
    [anchorName, contentId, dispatch, interactive, open, pairContains],
  );

  return <TooltipContext.Provider value={ctx}>{children}</TooltipContext.Provider>;
}

function TooltipTrigger({ children }: TooltipTriggerProps) {
  const ctx = useTooltip();
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  if (process.env.NODE_ENV !== 'production' && (!isValidElement(children) || Children.count(children) !== 1)) {
    console.error('Tooltip.Trigger expects a single element child');
  }

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const tabs = getTabbables(wrap);
    if (tabs.length === 0) wrap.tabIndex = 0;
    else wrap.removeAttribute('tabindex');
    const described = tabs[0] ?? wrap;
    if (ctx.open) described.setAttribute('aria-describedby', ctx.contentId);
    else described.removeAttribute('aria-describedby');
    return () => {
      described.removeAttribute('aria-describedby');
    };
  }, [children, ctx.contentId, ctx.open]);

  return (
    <span
      ref={(node) => {
        wrapRef.current = node;
        ctx.triggerRef.current = node;
      }}
      className={styles.trigger}
      style={triggerStyle(ctx.anchorName)}
      onPointerEnter={() => {
        ctx.dispatch({ kind: 'acquire', hold: 'hover', reason: 'hover' });
      }}
      onPointerLeave={(event) => {
        if (!ctx.pairContains(event.relatedTarget)) {
          ctx.dispatch({ kind: 'release', hold: 'hover' });
        }
      }}
      onFocus={() => {
        ctx.dispatch({ kind: 'acquire', hold: 'focus', reason: 'focus' });
      }}
      onBlur={(event) => {
        if (!ctx.pairContains(event.relatedTarget)) {
          ctx.dispatch({ kind: 'release', hold: 'focus' });
        }
      }}
    >
      {children}
    </span>
  );
}

function useContentPolicy(surface: TipSurface | PanelSurface, contentRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (process.env.NODE_ENV === 'production') return;
    const error = contentPolicyError(surface, el);
    if (error) console.error(error);
  }, [contentRef, surface]);
}

function TooltipTip({
  className,
  style,
  children,
  surface,
  ...props
}: TooltipContentProps & { surface: TipSurface }) {
  const ctx = useTooltip();
  useContentPolicy(surface, ctx.contentRef);
  return (
    <div
      {...props}
      {...surface.attrs}
      ref={(node) => {
        ctx.contentRef.current = node;
      }}
      data-open={ctx.open ? '' : undefined}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={contentStyle(ctx.anchorName, style)}
    >
      {children}
    </div>
  );
}

function TooltipPanel({
  className,
  style,
  children,
  surface,
  onPointerEnter,
  onPointerLeave,
  ...props
}: TooltipContentProps & { surface: PanelSurface }) {
  const ctx = useTooltip();
  usePopoverSync(ctx.contentRef, ctx.open);
  useContentPolicy(surface, ctx.contentRef);
  return (
    <div
      {...props}
      {...surface.attrs}
      ref={(node) => {
        ctx.contentRef.current = node;
      }}
      data-open={ctx.open ? '' : undefined}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={contentStyle(ctx.anchorName, style)}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        ctx.dispatch({ kind: 'acquire', hold: 'hover', reason: 'hover-bridge' });
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        if (!ctx.pairContains(event.relatedTarget)) {
          ctx.dispatch({ kind: 'release', hold: 'hover', reason: 'hover-bridge' });
        }
      }}
    >
      {children}
    </div>
  );
}

function TooltipContent({ className, style, children, ...props }: TooltipContentProps) {
  const ctx = useTooltip();
  const surface = resolveSurface(ctx.interactive, ctx.contentId);
  if (!isMounted(surface, ctx.open)) return null;
  if (surface.kind === 'panel') {
    return (
      <TooltipPanel className={className} style={style} surface={surface} {...props}>
        {children}
      </TooltipPanel>
    );
  }
  return (
    <TooltipTip className={className} style={style} surface={surface} {...props}>
      {children}
    </TooltipTip>
  );
}

Tooltip.Trigger = TooltipTrigger;
Tooltip.Content = TooltipContent;
