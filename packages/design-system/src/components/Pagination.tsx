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
 * One page, or the previous or next step: put your link or button inside. For
 * the page you are on, mark the item `current` and pass the page number as
 * text: it is drawn as the current page and marked `aria-current="page"`.
 */
export type PaginationItemProps = {
  current?: boolean;
} & ComponentPropsWithRef<'li'>;

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

function Item({ current = false, className, children, ...props }: PaginationItemProps) {
  return (
    <li {...props} className={cx(styles.item, className)}>
      {current ? (
        <span aria-current="page" className={styles.current}>
          {children}
        </span>
      ) : (
        children
      )}
    </li>
  );
}

function Ellipsis({ className, children = '…', ...props }: PaginationEllipsisProps) {
  return (
    <li aria-hidden="true" {...props} className={cx(styles.item, className)}>
      <span className={styles.ellipsis}>{children}</span>
    </li>
  );
}

export const Pagination = { Root, Item, Ellipsis } as const;
