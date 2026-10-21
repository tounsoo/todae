import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './Table.module.css';

/**
 * A native `table` styled from the table tokens. Build it from the Table parts:
 * each renders its native element, so the table keeps its meaning. A data
 * grid is out of scope.
 */
export type TableRootProps = ComponentPropsWithRef<'table'>;
/** A native `caption`, the table's name. Put it first in the root. */
export type TableCaptionProps = ComponentPropsWithRef<'caption'>;
/** A native `thead`. The `Table.HeaderCell` parts in its rows sit above a stronger rule. */
export type TableHeadProps = ComponentPropsWithRef<'thead'>;
/** A native `tbody`. */
export type TableBodyProps = ComponentPropsWithRef<'tbody'>;
/** A native `tfoot`. */
export type TableFootProps = ComponentPropsWithRef<'tfoot'>;
/** The sort state of a column: `ascending`, `descending`, or `none` for a column that can be sorted but is not. */
export type TableSort = 'ascending' | 'descending' | 'none';

/** A native `tr`. */
export type TableRowProps = {
  /** Marks the row selected: sets `data-selected` and a fill from the `table.row.bg.selected` token. It sets no ARIA; the row's checkbox carries the state. */
  selected?: boolean;
} & ComponentPropsWithRef<'tr'>;
/** A native `th`, a column or row header. Give it `scope`. */
export type TableHeaderCellProps = {
  /** The column's sort state. Sets `data-sort`, and `aria-sort` for `ascending` and `descending`; `none` leaves `aria-sort` off. */
  sort?: TableSort;
} & ComponentPropsWithRef<'th'>;
/** A native `td`. */
export type TableCellProps = ComponentPropsWithRef<'td'>;

function Root({ className, ...props }: TableRootProps) {
  return <table {...props} className={cx(styles.root, className)} />;
}

function Caption({ className, ...props }: TableCaptionProps) {
  return <caption {...props} className={cx(styles.caption, className)} />;
}

function Head({ className, ...props }: TableHeadProps) {
  return <thead {...props} className={cx(styles.head, className)} />;
}

function Body(props: TableBodyProps) {
  return <tbody {...props} />;
}

function Foot(props: TableFootProps) {
  return <tfoot {...props} />;
}

function Row({ selected, className, ...props }: TableRowProps) {
  return <tr data-selected={selected ? '' : undefined} {...props} className={cx(styles.row, className)} />;
}

function HeaderCell({ sort, className, ...props }: TableHeaderCellProps) {
  return (
    <th
      data-sort={sort}
      aria-sort={sort === 'ascending' || sort === 'descending' ? sort : undefined}
      {...props}
      className={cx(styles.headerCell, className)}
    />
  );
}

function Cell({ className, ...props }: TableCellProps) {
  return <td {...props} className={cx(styles.cell, className)} />;
}

export { Root, Caption, Head, Body, Foot, Row, HeaderCell, Cell };

export const Table = { Root, Caption, Head, Body, Foot, Row, HeaderCell, Cell } as const;
