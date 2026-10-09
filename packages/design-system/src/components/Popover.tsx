import { useRef, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from 'react';
import { usePopoverSync } from '../overlay/usePopoverSync';
import { useComposedRefs } from './props';
import type { PopoverWire } from './Popover.wire';
import styles from './Popover.module.css';
import { ToolbarContext } from './toolbarContext';

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

function PopoverRoot({
  id,
  open,
  ref: setRef,
  style,
  onPointerDown,
  onClick,
  children,
  className,
  role,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: PopoverRootProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  // A stable ref, so React does not detach and reattach the wire's ref every render.
  const refs = useComposedRefs(localRef, setRef);
  usePopoverSync(localRef, open);
  return (
    <div
      {...props}
      tabIndex={props.tabIndex ?? -1}
      id={id}
      ref={refs}
      popover="manual"
      role={role}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={style}
      onPointerDown={onPointerDown}
      onClick={onClick}
      aria-label={role ? ariaLabel : undefined}
      aria-labelledby={role ? ariaLabelledby : undefined}
    >
      <ToolbarContext.Provider value={null}>{children}</ToolbarContext.Provider>
    </div>
  );
}

export const Popover = { Root: PopoverRoot } as const;
