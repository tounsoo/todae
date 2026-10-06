import {
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { usePopoverSync } from '../overlay/usePopoverSync';
import {
  contentPolicyError,
  isMounted,
  resolveSurface,
  type PanelSurface,
  type TipSurface,
} from './Tooltip.surface';
import type { TooltipWire } from './Tooltip.wire';
import styles from './Tooltip.module.css';

export type TooltipContentName =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never };

export type TooltipChrome = { children?: ReactNode; className?: string; style?: CSSProperties };

type WithoutHandlers<T> = { [K in keyof T as K extends `on${string}` ? never : K]: T[K] };

/**
 * Other native attributes land on the tooltip element, except event handlers:
 * the trigger owns the tooltip's behavior. Its `ref` is the wire's; keep your
 * own with `composeRefs(wire.ref, yourRef)`.
 */
export type TooltipNativeProps = Omit<
  WithoutHandlers<ComponentPropsWithoutRef<'div'>>,
  | keyof TooltipWire<true>
  | 'popover'
  | 'role'
  | 'aria-label'
  | 'aria-labelledby'
  | 'children'
  | 'className'
  | 'style'
>;

export type TooltipProps =
  | (TooltipWire<false> & TooltipChrome & TooltipNativeProps)
  | (TooltipWire<true> & TooltipChrome & TooltipContentName & TooltipNativeProps);

function contentNameOf(
  props: { 'aria-label'?: string; 'aria-labelledby'?: string },
): TooltipContentName | undefined {
  if (typeof props['aria-label'] === 'string') return { 'aria-label': props['aria-label'] };
  if (typeof props['aria-labelledby'] === 'string') return { 'aria-labelledby': props['aria-labelledby'] };
  return undefined;
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
  open,
  ref: setRef,
  ...props
}: TooltipChrome & TooltipNativeProps & { surface: TipSurface; open: boolean; ref: TooltipWire['ref'] }) {
  const localRef = useRef<HTMLDivElement | null>(null);
  useContentPolicy(surface, localRef);
  return (
    <div
      {...props}
      {...surface.attrs}
      ref={(node) => {
        localRef.current = node;
        setRef(node);
      }}
      data-open={open ? '' : undefined}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={style}
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
  open,
  ref: setRef,
  onPointerEnter,
  onPointerLeave,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: TooltipChrome &
  TooltipNativeProps &
  TooltipContentName & {
    surface: PanelSurface;
    open: boolean;
    ref: TooltipWire<true>['ref'];
    onPointerEnter: TooltipWire<true>['onPointerEnter'];
    onPointerLeave: TooltipWire<true>['onPointerLeave'];
  }) {
  const localRef = useRef<HTMLDivElement | null>(null);
  usePopoverSync(localRef, open);
  useContentPolicy(surface, localRef);
  return (
    <div
      {...props}
      {...surface.attrs}
      {...contentNameOf({ 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby })}
      ref={(node) => {
        localRef.current = node;
        setRef(node);
      }}
      data-open={open ? '' : undefined}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>
  );
}

export function Tooltip(props: TooltipProps) {
  const surface = resolveSurface(props.interactive, props.id);
  if (!isMounted(surface, props.open)) return null;
  if (props.interactive) {
    const { id: _id, interactive: _interactive, 'aria-label': _label, 'aria-labelledby': _labelledby, ...rest } = props;
    const name = contentNameOf(props);
    return (
      <TooltipPanel {...rest} {...name!} surface={surface as PanelSurface}>
        {props.children}
      </TooltipPanel>
    );
  }
  const { id: _id, interactive: _interactive, ...rest } = props;
  return (
    <TooltipTip {...rest} surface={surface as TipSurface}>
      {props.children}
    </TooltipTip>
  );
}
