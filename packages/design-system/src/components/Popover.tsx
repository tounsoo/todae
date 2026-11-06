import { createElement, useRef, type ComponentPropsWithoutRef, type CSSProperties, type FocusEvent, type ReactNode } from 'react';
import { SurfaceChildren, useSurfaceClosedSignal } from '../overlay/surfaceContext.js';
import { usePopoverSync } from '../overlay/usePopoverSync.js';
import { composeHandlers, useComposedRefs } from '../internal/props.js';
import { revealRing } from '../internal/revealRing.js';
import type { PopoverWire } from '../overlay/popoverWire.js';
import { cx } from '../internal/cx.js';
import { ScrollEdges } from './scrollEdges.js';
import styles from './Popover.module.css';

type PopoverBase = {
  /**
   * Whether an arrow shows at its top or bottom edge while what it holds is
   * cut off there. Resting a mouse or pen on one scrolls toward it. On by
   * default, as a popover holds its list and scrolls past its max height.
   */
  arrows?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * A name needs a role: ARIA prohibits `aria-label` on a plain element, so a
 * role-less popover takes no name. Name what is inside it instead, such as
 * the listbox of a combobox, or make it `role="dialog"`.
 */
export type PopoverChrome =
  | (PopoverBase & {
      role?: undefined;
      'aria-label'?: never;
      'aria-labelledby'?: never;
    })
  | (PopoverBase & {
      role: 'dialog';
      'aria-label': string;
      'aria-labelledby'?: string;
    })
  | (PopoverBase & {
      role: 'dialog';
      'aria-labelledby': string;
      'aria-label'?: string;
    });

/**
 * Other native attributes land on the popover element. Its `ref` is the
 * wire's; keep your own with `composeRefs(wire.ref, yourRef)`.
 */
export type PopoverNativeProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  keyof PopoverWire | 'popover' | 'role' | 'aria-label' | 'aria-labelledby' | 'children' | 'className' | 'style'
>;

export type PopoverRootProps = PopoverWire & PopoverChrome & PopoverNativeProps;

/**
 * Popover.Root's element. Mention's peek uses `as="span"`, a phrasing
 * element, so a mention and its always-mounted peek can sit inside a
 * paragraph, as Tooltip.Root's span does. Not exported from the package.
 */
export function PopoverSurface({
  as = 'div',
  id,
  open,
  ref: setRef,
  style,
  onPointerDown,
  onClick,
  onFocus,
  children,
  arrows = true,
  className,
  role,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: PopoverRootProps & { as?: 'div' | 'span' }) {
  const localRef = useRef<HTMLElement | null>(null);
  // A stable ref, so React does not detach and reattach the wire's ref every render.
  const refs = useComposedRefs(localRef, setRef);
  // It finishes closing as its exit fade ends, or at once with no fade, and
  // then tells what it holds. Opening again inside the fade, while it still
  // shows, takes it back without finishing, as a Dialog does, so what it
  // holds keeps its place and focus has somewhere to land.
  const [closedListeners, closed] = useSurfaceClosedSignal();
  usePopoverSync(localRef, open, { onExited: closed });
  return createElement(
    as,
    {
      ...props,
      tabIndex: props.tabIndex ?? -1,
      id,
      ref: refs,
      popover: 'manual',
      role,
      className: cx(styles.content, className),
      style,
      onPointerDown,
      onClick,
      onFocus: composeHandlers(onFocus, (event: FocusEvent<HTMLElement>) => revealRing(event.currentTarget, event.target)),
      'aria-label': role ? ariaLabel : undefined,
      'aria-labelledby': role ? ariaLabelledby : undefined,
    },
    arrows && <ScrollEdges axis="block" active={open} />,
    <SurfaceChildren listeners={closedListeners}>{children}</SurfaceChildren>,
  );
}

function PopoverRoot(props: PopoverRootProps) {
  return <PopoverSurface {...props} />;
}

export const Popover = { Root: PopoverRoot } as const;
