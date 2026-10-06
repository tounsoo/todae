import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './ErrorMessage.module.css';

export type ErrorMessageProps = {
  id: string;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'span'>, 'id' | 'children'>;

export function ErrorMessage({ id, className, ...props }: ErrorMessageProps) {
  return (
    <span
      {...props}
      id={id}
      data-todae-error=""
      className={[styles.error, className].filter(Boolean).join(' ')}
    />
  );
}
