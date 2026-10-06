import type { ComponentPropsWithRef } from 'react';
import styles from './Chip.module.css';

export type ChipProps = {
  children: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  disabled?: boolean;
} & Omit<ComponentPropsWithRef<'span'>, 'children'>;

export type ChipOverflowProps = {
  overflowCount: number;
  overflowLabel?: (n: number) => string;
} & Omit<ComponentPropsWithRef<'span'>, 'children'>;

function chipClass(className?: string): string {
  return [styles.root, className].filter(Boolean).join(' ');
}

export function Chip({
  children,
  onDismiss,
  dismissLabel,
  disabled,
  className,
  ...props
}: ChipProps) {
  if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
    console.error('Chip children must be a string');
  }
  const label = typeof children === 'string' ? children : String(children);
  return (
    <span {...props} className={chipClass(className)} data-disabled={disabled ? '' : undefined}>
      <span className={styles.label}>{label}</span>
      {onDismiss ? (
        <button
          type="button"
          className={styles.dismiss}
          aria-label={dismissLabel ?? `Remove ${label}`}
          disabled={disabled}
          onClick={disabled ? undefined : onDismiss}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function ChipOverflow({
  overflowCount,
  overflowLabel,
  className,
  ...props
}: ChipOverflowProps) {
  const name = overflowLabel?.(overflowCount) ?? `${overflowCount} more`;
  return (
    <span {...props} className={chipClass(className)} data-overflow="">
      <span className={styles.label} aria-hidden>
        +{overflowCount}
      </span>
      <span className={styles.vh}>{name}</span>
    </span>
  );
}

Chip.Overflow = ChipOverflow;
