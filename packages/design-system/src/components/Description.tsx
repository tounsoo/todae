import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import styles from './Description.module.css';

export type DescriptionRootProps = {
  id: string;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'span'>, 'id' | 'children'>;

function Root({ id, className, ...props }: DescriptionRootProps) {
  return (
    <span
      {...props}
      id={id}
      data-todae-description=""
      className={cx(styles.description, className)}
    />
  );
}

export const Description = { Root } as const;
