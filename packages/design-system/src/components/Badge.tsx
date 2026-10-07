import type { ComponentPropsWithRef } from 'react';
import { cx } from './props';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

/** A static label. It has no role, so it is read as part of the text around it. */
export type BadgeRootProps = {
  tone?: BadgeTone;
} & ComponentPropsWithRef<'span'>;

function Root({ tone = 'neutral', className, ...props }: BadgeRootProps) {
  return <span {...props} data-tone={tone} className={cx(styles.root, className)} />;
}

export const Badge = { Root } as const;
