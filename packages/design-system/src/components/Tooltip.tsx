import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTooltip, type TooltipOpenReason, type UseTooltipResult } from '../hooks/useTooltip';
import { usePopoverSync } from '../overlay/usePopoverSync';
import { getTabbables } from '../overlay/tabbables';
import {
  contentPolicyError,
  isMounted,
  resolveSurface,
  type PanelSurface,
  type TipSurface,
} from './Tooltip.surface';
import styles from './Tooltip.module.css';

export type { TooltipOpenReason };

export type TooltipContentName =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never };

type TooltipContentChrome = Omit<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'popover' | 'tabIndex' | 'id' | 'aria-label' | 'aria-labelledby'
>;

export type TooltipContentProps = TooltipContentChrome & TooltipContentName;

type TooltipTextContentProps = TooltipContentChrome & {
  'aria-label'?: never;
  'aria-labelledby'?: never;
};

type TooltipSharedProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: TooltipOpenReason) => void;
  showDelay?: number;
  hideDelay?: number;
  children: ReactNode;
};

export type TooltipProps =
  | ({ interactive?: false } & TooltipSharedProps)
  | ({ interactive: true } & TooltipSharedProps & TooltipContentName);

export type TooltipTriggerProps = {
  children: ReactNode;
};

function contentNameOf(
  props: { 'aria-label'?: string; 'aria-labelledby'?: string },
): TooltipContentName | undefined {
  if (typeof props['aria-label'] === 'string') return { 'aria-label': props['aria-label'] };
  if (typeof props['aria-labelledby'] === 'string') return { 'aria-labelledby': props['aria-labelledby'] };
  return undefined;
}

type TooltipParts = UseTooltipResult<boolean> & {
  contentName: TooltipContentName | undefined;
};

const TooltipPartsContext = createContext<TooltipParts | null>(null);

function useTooltipParts(): TooltipParts {
  const ctx = useContext(TooltipPartsContext);
  if (!ctx) throw new Error('Tooltip parts must render inside Tooltip');
  return ctx;
}

function contentStyle(anchorStyle: CSSProperties, style?: CSSProperties): CSSProperties {
  return { ...style, ...anchorStyle };
}

export function Tooltip(props: TooltipProps) {
  const {
    interactive = false,
    open: openProp,
    defaultOpen,
    onOpenChange,
    showDelay,
    hideDelay,
    children,
  } = props;
  const machine = useTooltip({
    interactive,
    open: openProp,
    defaultOpen,
    onOpenChange,
    showDelay,
    hideDelay,
  });
  const ariaLabel = 'aria-label' in props ? props['aria-label'] : undefined;
  const ariaLabelledby = 'aria-labelledby' in props ? props['aria-labelledby'] : undefined;
  const contentName = useMemo(
    () =>
      interactive ? contentNameOf({ 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }) : undefined,
    [ariaLabel, ariaLabelledby, interactive],
  );
  const ctx = useMemo<TooltipParts>(
    () => ({ ...machine, contentName }),
    [contentName, machine],
  );

  return <TooltipPartsContext.Provider value={ctx}>{children}</TooltipPartsContext.Provider>;
}

function TooltipTrigger({ children }: TooltipTriggerProps) {
  const ctx = useTooltipParts();
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const wire = ctx.getTriggerProps({ className: styles.trigger });

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
    if (ctx.open) described.setAttribute('aria-describedby', ctx.ids.tooltip);
    else described.removeAttribute('aria-describedby');
    return () => {
      described.removeAttribute('aria-describedby');
    };
  }, [children, ctx.ids.tooltip, ctx.open]);

  const { 'aria-describedby': _described, ref, ...triggerWire } = wire;

  return (
    <span
      {...triggerWire}
      ref={(node) => {
        wrapRef.current = node;
        ref(node);
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
}: (TooltipContentProps | TooltipTextContentProps) & { surface: TipSurface }) {
  const ctx = useTooltipParts();
  const wire = ctx.getTooltipProps();
  useContentPolicy(surface, ctx.tooltipRef);
  return (
    <div
      {...props}
      {...surface.attrs}
      ref={wire.ref}
      data-open={ctx.open ? '' : undefined}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={contentStyle(wire.style, style)}
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
}: (TooltipContentProps | TooltipTextContentProps) & { surface: PanelSurface }) {
  const ctx = useTooltipParts();
  const wire = ctx.getTooltipProps();
  usePopoverSync(ctx.tooltipRef, ctx.open);
  useContentPolicy(surface, ctx.tooltipRef);
  const name = contentNameOf(props) ?? ctx.contentName;
  return (
    <div
      {...props}
      {...surface.attrs}
      {...name}
      ref={wire.ref}
      data-open={ctx.open ? '' : undefined}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={contentStyle(wire.style, style)}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if ('onPointerEnter' in wire) wire.onPointerEnter(event);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        if ('onPointerLeave' in wire) wire.onPointerLeave(event);
      }}
    >
      {children}
    </div>
  );
}

function TooltipContent({
  className,
  style,
  children,
  ...props
}: TooltipContentProps | TooltipTextContentProps) {
  const ctx = useTooltipParts();
  const surface = resolveSurface(ctx.interactive, ctx.ids.tooltip);
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
