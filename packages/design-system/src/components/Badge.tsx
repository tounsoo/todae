import type { ComponentPropsWithRef } from 'react';
import type { AlertTone } from './Alert';
import { cx } from './cx';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | AlertTone;

/** A static label. It has no role, so it is read as part of the text around it. */
export type BadgeRootProps = {
  tone?: BadgeTone;
} & ComponentPropsWithRef<'span'>;

function Root({ tone = 'neutral', className, ...props }: BadgeRootProps) {
  return <span {...props} data-tone={tone} className={cx(styles.root, className)} />;
}

export const Badge = { Root } as const;
