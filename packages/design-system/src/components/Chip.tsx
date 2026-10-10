import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useStrings } from '../providers/StringsProvider';
import type { AlertTone } from './Alert';
import type { CategoryTone } from './tone';
import styles from './Chip.module.css';

export type ChipTone = 'neutral' | AlertTone | CategoryTone;

export type ChipRootProps = {
  children: string;
  /** Colors from the chip.<tone> contract tokens. A disabled chip takes the disabled colors instead. */
  tone?: ChipTone;
  onRemove?: () => void;
  /** Remove button name. Default is the `removeChip` string, "Remove {label}" in English. */
  removeLabel?: string;
  /** Remove button content, such as an icon from your own set. Without it, the CSS draws a cross. */
  removeIcon?: ReactNode;
  disabled?: boolean;
} & Omit<ComponentPropsWithRef<'span'>, 'children'>;

export type ChipOverflowProps = {
  overflowCount: number;
  /** Name read for +N. Default is the `moreChips` string, "{n} more" in English. */
  overflowLabel?: (n: number) => string;
} & Omit<ComponentPropsWithRef<'span'>, 'children'>;

function chipClass(className?: string): string {
  return [styles.root, className].filter(Boolean).join(' ');
}

function ChipRoot({
  children,
  onRemove,
  removeLabel,
  removeIcon,
  disabled,
  tone = 'neutral',
  className,
  ...props
}: ChipRootProps) {
  const { removeChip } = useStrings();
  if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
    console.error('Chip.Root children must be a string');
  }
  const label = typeof children === 'string' ? children : String(children);
  return (
    <span {...props} className={chipClass(className)} data-tone={tone} data-disabled={disabled ? '' : undefined}>
      <span className={styles.label}>{label}</span>
      {onRemove ? (
        <button
          type="button"
          className={styles.dismiss}
          aria-label={removeLabel || removeChip(label)}
          disabled={disabled}
          onClick={disabled ? undefined : onRemove}
        >
          {removeIcon}
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
  const { moreChips } = useStrings();
  const name = overflowLabel?.(overflowCount) ?? moreChips(overflowCount);
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
