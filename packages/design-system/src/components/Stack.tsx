import type { HTMLAttributes } from 'react';
import styles from './Stack.module.css';

export type StackDirection = 'row' | 'column';
export type StackGap = 's' | 'm' | 'l';

export type StackProps = {
  direction?: StackDirection;
  gap?: StackGap;
} & HTMLAttributes<HTMLDivElement>;

export function Stack({
  direction = 'column',
  gap = 'm',
  className,
  ...props
}: StackProps) {
  const classes = [styles.root, styles[direction], styles[gap], className]
    .filter(Boolean)
    .join(' ');
  return <div {...props} className={classes} />;
}
