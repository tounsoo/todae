import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import styles from './Stack.module.css';

export type StackDirection = 'row' | 'column';

export type StackRootProps = {
  direction?: StackDirection;
} & ComponentPropsWithRef<'div'>;

function Root({
  direction = 'column',
  className,
  ...props
}: StackRootProps) {
  return <div {...props} className={cx(styles.root, styles[direction], className)} />;
}

export const Stack = { Root } as const;
