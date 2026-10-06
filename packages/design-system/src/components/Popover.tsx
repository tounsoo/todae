import { useRef, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from 'react';
import { usePopoverSync } from '../overlay/usePopoverSync';
import type { PopoverWire } from './Popover.wire';
import styles from './Popover.module.css';

type PopoverBase = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export type PopoverChrome =
  | (PopoverBase & {
      role?: undefined;
      'aria-label'?: string;
      'aria-labelledby'?: string;
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

export type PopoverProps = PopoverWire & PopoverChrome & PopoverNativeProps;

export function Popover({
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
}: PopoverProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  usePopoverSync(localRef, open);
  return (
    <div
      {...props}
      tabIndex={props.tabIndex ?? -1}
      id={id}
      ref={(node) => {
        localRef.current = node;
        setRef(node);
      }}
      popover="manual"
      role={role}
      className={[styles.content, className].filter(Boolean).join(' ')}
      style={style}
      onPointerDown={onPointerDown}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
    >
      {children}
    </div>
  );
}
