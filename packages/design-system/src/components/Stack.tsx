import type { HTMLAttributes } from 'react';
import styles from './Stack.module.css';

export type StackDirection = 'row' | 'column';

export type StackProps = {
  direction?: StackDirection;
} & HTMLAttributes<HTMLDivElement>;

export function Stack({
  direction = 'column',
  className,
  ...props
}: StackProps) {
  const classes = [styles.root, styles[direction], className].filter(Boolean).join(' ');
  return <div {...props} className={classes} />;
}
