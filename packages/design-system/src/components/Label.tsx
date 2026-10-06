import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './Label.module.css';

export type LabelProps = {
  htmlFor: string;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'label'>, 'htmlFor' | 'children'>;

export function Label({ htmlFor, className, ...props }: LabelProps) {
  return (
    <label
      {...props}
      htmlFor={htmlFor}
      className={[styles.label, className].filter(Boolean).join(' ')}
    />
  );
}
