import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import styles from './Pagination.module.css';

export { paginationRange, type PaginationRangeItem, type PaginationRangeOptions } from './paginationRange';

/**
 * A `nav` landmark holding an ordered list of pages. Named "Pagination" unless
 * you pass `aria-label` or `aria-labelledby`; that default is English.
 */
export type PaginationRootProps = ComponentPropsWithRef<'nav'>;

/**
 * One page, or the previous or next step: put your link or button inside.
 * Mark the current page's control `aria-current="page"` and a step with
 * nowhere to go `aria-disabled="true"`.
 */
export type PaginationItemProps = ComponentPropsWithRef<'li'>;

/** Stands for the pages a gap leaves out. Drawn as "…" by default; screen readers skip it. */
export type PaginationEllipsisProps = ComponentPropsWithRef<'li'>;

function Root({ 'aria-label': ariaLabel, 'aria-labelledby': labelledby, className, children, ...props }: PaginationRootProps) {
  return (
    <nav
      {...props}
      aria-label={ariaLabel || (labelledby ? undefined : 'Pagination')}
      aria-labelledby={labelledby}
      className={cx(styles.root, className)}
    >
      {/* Safari drops the list role from a list without markers; role="list" keeps it. */}
      <ol role="list" className={styles.list}>
        {children}
      </ol>
    </nav>
  );
}

function Item({ className, ...props }: PaginationItemProps) {
  return <li {...props} className={cx(styles.item, className)} />;
}

function Ellipsis({ className, children = '…', ...props }: PaginationEllipsisProps) {
  return (
    <li aria-hidden="true" {...props} className={cx(styles.item, className)}>
      <span className={styles.ellipsis}>{children}</span>
    </li>
  );
}

export const Pagination = { Root, Item, Ellipsis } as const;
