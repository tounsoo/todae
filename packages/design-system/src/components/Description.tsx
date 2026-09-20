import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Description.module.css';

export type DescriptionProps = {
  id: string;
  children?: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'id' | 'children'>;

export function Description({ id, className, ...props }: DescriptionProps) {
  return (
    <span
      {...props}
      id={id}
      className={[styles.description, className].filter(Boolean).join(' ')}
    />
  );
}
