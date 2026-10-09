import type { ComponentPropsWithRef } from 'react';
import styles from './Chip.module.css';

export type ChipRootProps = {
  children: string;
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
} & Omit<ComponentPropsWithRef<'span'>, 'children'>;

export type ChipOverflowProps = {
  overflowCount: number;
  overflowLabel?: (n: number) => string;
} & Omit<ComponentPropsWithRef<'span'>, 'children'>;

function chipClass(className?: string): string {
  return [styles.root, className].filter(Boolean).join(' ');
}

function ChipRoot({
  children,
  onRemove,
  removeLabel,
  disabled,
  className,
  ...props
}: ChipRootProps) {
  if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
    console.error('Chip.Root children must be a string');
  }
  const label = typeof children === 'string' ? children : String(children);
  return (
    <span {...props} className={chipClass(className)} data-disabled={disabled ? '' : undefined}>
      <span className={styles.label}>{label}</span>
      {onRemove ? (
        <button
          type="button"
          className={styles.dismiss}
          aria-label={removeLabel ?? `Remove ${label}`}
          disabled={disabled}
          onClick={disabled ? undefined : onRemove}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function ChipOverflow({
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

export const Chip = { Root: ChipRoot, Overflow: ChipOverflow } as const;
