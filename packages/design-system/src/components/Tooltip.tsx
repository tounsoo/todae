import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
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

export type TooltipProps =
  | (TooltipWire<false> & TooltipChrome)
  | (TooltipWire<true> & TooltipChrome & TooltipContentName);

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
}: TooltipChrome & { surface: TipSurface; open: boolean; ref: TooltipWire['ref'] }) {
  const localRef = useRef<HTMLDivElement | null>(null);
  useContentPolicy(surface, localRef);
  return (
    <div
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
  ...name
}: TooltipChrome &
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
      {...surface.attrs}
      {...contentNameOf(name)}
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
    const name = contentNameOf(props);
    return (
      <TooltipPanel
        className={props.className}
        style={props.style}
        surface={surface as PanelSurface}
        open={props.open}
        ref={props.ref}
        onPointerEnter={props.onPointerEnter}
        onPointerLeave={props.onPointerLeave}
        {...name!}
      >
        {props.children}
      </TooltipPanel>
    );
  }
  return (
    <TooltipTip
      className={props.className}
      style={props.style}
      surface={surface as TipSurface}
      open={props.open}
      ref={props.ref}
    >
      {props.children}
    </TooltipTip>
  );
}
