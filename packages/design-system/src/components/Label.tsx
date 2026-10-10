import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import styles from './Label.module.css';

export type LabelRootProps = {
  htmlFor: string;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'label'>, 'htmlFor' | 'children'>;

function Root({ htmlFor, className, ...props }: LabelRootProps) {
  return (
    <label
      {...props}
      htmlFor={htmlFor}
      className={cx(styles.label, className)}
    />
  );
}

export const Label = { Root } as const;
