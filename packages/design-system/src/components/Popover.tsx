import { createElement, useLayoutEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties, type FocusEvent, type ReactNode } from 'react';
import { SurfaceChildren, useSurfaceClosedSignal } from '../overlay/surfaceContext.js';
import { usePopoverSync } from '../overlay/usePopoverSync.js';
import { whenExited } from '../overlay/whenExited.js';
import { composeHandlers, useComposedRefs } from '../internal/props.js';
import { revealRing } from '../internal/revealRing.js';
import type { PopoverWire } from '../overlay/popoverWire.js';
import { cx } from '../internal/cx.js';
import styles from './Popover.module.css';

type PopoverBase = {
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
  className,
  role,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: PopoverRootProps & { as?: 'div' | 'span' }) {
  const localRef = useRef<HTMLElement | null>(null);
  // A stable ref, so React does not detach and reattach the wire's ref every render.
  const refs = useComposedRefs(localRef, setRef);
  usePopoverSync(localRef, open);
  // It finishes closing as its exit fade ends, or at once with no fade.
  // Opening again inside the fade finishes it then, so what it holds still
  // starts over; unmounting just drops the wait.
  const [closedListeners, closed] = useSurfaceClosedSignal();
  const wasOpen = useRef(open);
  const exiting = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const closing = wasOpen.current && !open;
    wasOpen.current = open;
    if (closing) {
      let ended = false;
      const cancel = whenExited(localRef.current, 'opacity', () => {
        ended = true;
        exiting.current = null;
        closed();
      });
      if (!ended) exiting.current = cancel;
    } else if (open && exiting.current) {
      exiting.current();
      exiting.current = null;
      closed();
    }
  }, [closed, open]);
  useLayoutEffect(() => () => exiting.current?.(), []);
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
    <SurfaceChildren listeners={closedListeners}>{children}</SurfaceChildren>,
  );
}

function PopoverRoot(props: PopoverRootProps) {
  return <PopoverSurface {...props} />;
}

export const Popover = { Root: PopoverRoot } as const;
