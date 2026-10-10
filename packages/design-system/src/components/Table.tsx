import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import styles from './Table.module.css';

/**
 * A native `table` styled from the table tokens. Write its `caption`, `thead`,
 * `tbody`, `tr`, `th` and `td` as plain elements inside: they keep their meaning,
 * and the root styles them. A data grid is out of scope.
 */
export type TableRootProps = ComponentPropsWithRef<'table'>;

function Root({ className, ...props }: TableRootProps) {
  return <table {...props} className={cx(styles.root, className)} />;
}

export const Table = { Root } as const;
