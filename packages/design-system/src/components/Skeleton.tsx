import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import styles from './Skeleton.module.css';

/**
 * A placeholder block shown where content is still loading. Elements inside only
 * give it a size and are hidden; it pulses unless the user asks for reduced motion.
 */
export type SkeletonRootProps = ComponentPropsWithRef<'div'>;

function Root({ className, ...props }: SkeletonRootProps) {
  return <div {...props} className={cx(styles.root, className)} />;
}

export const Skeleton = { Root } as const;
