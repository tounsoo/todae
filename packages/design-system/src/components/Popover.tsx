import { useRef, type CSSProperties, type ReactNode } from 'react';
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

export type PopoverProps = PopoverWire & PopoverChrome;

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
}: PopoverProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  usePopoverSync(localRef, open);
  return (
    <div
      id={id}
      ref={(node) => {
        localRef.current = node;
        setRef(node);
      }}
      popover="manual"
      tabIndex={-1}
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
