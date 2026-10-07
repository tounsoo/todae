import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { cx } from './props';
import styles from './Breadcrumbs.module.css';

/**
 * A `nav` landmark holding an ordered list. Named "Breadcrumb" unless you pass
 * `aria-label` or `aria-labelledby`; that default is English.
 */
export type BreadcrumbsRootProps = {
  /** Text drawn between items, "/" by default. Screen readers skip it. */
  separator?: string;
} & ComponentPropsWithRef<'nav'>;

/**
 * One step in the trail: put a link inside, or plain text for the page you are
 * on and mark that item `current`.
 */
export type BreadcrumbsItemProps = {
  current?: boolean;
} & ComponentPropsWithRef<'li'>;

/** A CSS string literal for `text`: quotes, backslashes and control characters escaped. */
function cssString(text: string): string {
  // Control characters are the point: CSS reads them differently from JS.
  // eslint-disable-next-line no-control-regex
  const escaped = text.replace(/[\\"\u0000-\u001f\u007f]/g, (char) =>
    char === '\\' || char === '"' ? `\\${char}` : `\\${char.charCodeAt(0).toString(16)} `,
  );
  return `"${escaped}"`;
}

function Root({
  separator,
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
      aria-label={ariaLabel || (labelledby ? undefined : 'Breadcrumb')}
      aria-labelledby={labelledby}
      className={cx(styles.root, className)}
      style={separator === undefined ? style : ({ '--todae-breadcrumbs-glyph': cssString(separator), ...style } as CSSProperties)}
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
