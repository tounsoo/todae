import type { ComponentPropsWithRef } from 'react';
import { cx } from '../internal/cx.js';
import styles from './Skeleton.module.css';

/** `pulse` fades the block in and out; `shimmer` sweeps a band across it. */
export type SkeletonVariant = 'pulse' | 'shimmer';

/**
 * A placeholder block shown where content is still loading. Elements inside only
 * give it a size and are hidden; it pulses or shimmers unless the user asks for
 * reduced motion, when it holds still.
 */
export type SkeletonRootProps = ComponentPropsWithRef<'div'> & {
  /** How it moves. Default `pulse`. */
  variant?: SkeletonVariant;
};

function Root({ className, variant = 'pulse', ...props }: SkeletonRootProps) {
  return <div {...props} data-variant={variant} className={cx(styles.root, className)} />;
}

export const Skeleton = { Root } as const;
