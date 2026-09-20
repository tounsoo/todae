import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
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
import styles from './Tooltip.module.css';

export type TooltipContentName =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never };

type TooltipChrome = Omit<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'popover' | 'tabIndex' | 'id' | 'aria-label' | 'aria-labelledby'
> & {
  id: string;
  open: boolean;
  ref?: Ref<HTMLDivElement | null>;
  children?: ReactNode;
};

export type TooltipProps =
  | ({ interactive?: false } & TooltipChrome)
  | ({ interactive: true } & TooltipChrome & TooltipContentName);

function contentNameOf(
  props: { 'aria-label'?: string; 'aria-labelledby'?: string },
): TooltipContentName | undefined {
  if (typeof props['aria-label'] === 'string') return { 'aria-label': props['aria-label'] };
  if (typeof props['aria-labelledby'] === 'string') return { 'aria-labelledby': props['aria-labelledby'] };
  return undefined;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function mergeStyle(anchorStyle: CSSProperties | undefined, style?: CSSProperties): CSSProperties {
  return { ...style, ...anchorStyle };
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
  ref,
  ...props
}: TooltipChrome & { surface: TipSurface }) {
  const localRef = useRef<HTMLDivElement | null>(null);
  useContentPolicy(surface, localRef);
  return (
    <div
      {...props}
      {...surface.attrs}
      ref={(node) => {
        localRef.current = node;
        assignRef(ref, node);
      }}
      data-open={open ? '' : undefined}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={mergeStyle(style)}
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
  ref,
  onPointerEnter,
  onPointerLeave,
  ...props
}: (TooltipChrome & TooltipContentName) & { surface: PanelSurface }) {
  const localRef = useRef<HTMLDivElement | null>(null);
  usePopoverSync(localRef, open);
  useContentPolicy(surface, localRef);
  const name = contentNameOf(props);
  return (
    <div
      {...props}
      {...surface.attrs}
      {...name}
      ref={(node) => {
        localRef.current = node;
        assignRef(ref, node);
      }}
      data-open={open ? '' : undefined}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={mergeStyle(style)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>
  );
}

export function Tooltip(props: TooltipProps) {
  const { id, open, interactive = false, children, ...rest } = props;
  const surface = resolveSurface(interactive, id);
  if (!isMounted(surface, open)) return null;
  if (surface.kind === 'panel') {
    return (
      <TooltipPanel {...(rest as TooltipChrome & TooltipContentName)} surface={surface} id={id} open={open}>
        {children}
      </TooltipPanel>
    );
  }
  return (
    <TooltipTip {...(rest as TooltipChrome)} surface={surface} id={id} open={open}>
      {children}
    </TooltipTip>
  );
}
