import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './Progress.module.css';

/**
 * A native `progress`: how far a task has come. Leave out `value` when the end is
 * unknown, and a band sweeps the track. It keeps the progressbar role, so it needs a name.
 */
export type ProgressRootProps = ComponentPropsWithRef<'progress'>;

function Root({ className, ...props }: ProgressRootProps) {
  return <progress {...props} className={cx(styles.root, styles.progress, className)} />;
}

export const Progress = { Root } as const;
