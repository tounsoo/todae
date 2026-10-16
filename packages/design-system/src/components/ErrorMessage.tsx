import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx.js';
import styles from './ErrorMessage.module.css';

export type ErrorMessageRootProps = {
  id: string;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'span'>, 'id' | 'children'>;

function Root({ id, className, ...props }: ErrorMessageRootProps) {
  return (
    <span
      {...props}
      id={id}
      data-todae-error=""
      className={cx(styles.error, className)}
    />
  );
}

export const ErrorMessage = { Root } as const;
