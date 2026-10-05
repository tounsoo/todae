import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './Description.module.css';

export type DescriptionProps = {
  id: string;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'span'>, 'id' | 'children'>;

export function Description({ id, className, ...props }: DescriptionProps) {
  return (
    <span
      {...props}
      id={id}
      data-todae-description=""
      className={[styles.description, className].filter(Boolean).join(' ')}
    />
  );
}
