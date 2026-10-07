import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { cx } from './props';
import styles from './Breadcrumbs.module.css';

/**
 * A `nav` landmark holding an ordered list. Named "Breadcrumb" unless you pass
 * `aria-label` or `aria-labelledby`; that default is English.
 */
export type BreadcrumbsRootProps = {
  /** Text drawn between items. Screen readers skip it. */
  separator?: string;
} & ComponentPropsWithRef<'nav'>;

/**
 * One step in the trail: put a link inside, or plain text for the page you are
 * on and mark that item `current`.
 */
export type BreadcrumbsItemProps = {
  current?: boolean;
} & ComponentPropsWithRef<'li'>;

function Root({
  separator = '/',
  'aria-label': ariaLabel,
  'aria-labelledby': labelledby,
  className,
  style,
  children,
  ...props
}: BreadcrumbsRootProps) {
  return (
    <nav
      {...props}
      aria-label={ariaLabel ?? (labelledby ? undefined : 'Breadcrumb')}
      aria-labelledby={labelledby}
      className={cx(styles.root, className)}
      style={{ '--todae-breadcrumbs-glyph': JSON.stringify(separator), ...style } as CSSProperties}
    >
      <ol className={styles.list}>{children}</ol>
    </nav>
  );
}

function Item({ current = false, className, children, ...props }: BreadcrumbsItemProps) {
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

export const Breadcrumbs = { Root, Item } as const;
