import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react';
import { DEFAULT_STRINGS } from '../providers/strings';
import { cx } from './cx';
import { hasGlyph } from './glyphs';
import styles from './Breadcrumbs.module.css';

/**
 * A `nav` landmark holding an ordered list. Named by the `breadcrumbs` string
 * ("Breadcrumb" in English) unless you pass `aria-label` or `aria-labelledby`.
 * The server entry has no StringsProvider, so it always uses English.
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
      aria-label={ariaLabel || (labelledby ? undefined : DEFAULT_STRINGS.breadcrumbs)}
      aria-labelledby={labelledby}
      className={cx(styles.root, className)}
      style={separator === undefined ? style : ({ '--todae-breadcrumbs-glyph': cssString(separator), ...style } as CSSProperties)}
    >
      {/* Safari drops the list role from a list without markers; role="list" keeps it. */}
      <ol role="list" className={styles.list}>
        {children}
      </ol>
    </nav>
  );
}

/** Item, with a separator glyph drawn before it in place of the separator text. The main entry passes it. */
export function ItemWithGlyph({
  separatorGlyph,
  current = false,
  className,
  children,
  ...props
}: BreadcrumbsItemProps & { separatorGlyph?: ReactNode }) {
  return (
    <li {...props} className={cx(styles.item, className)}>
      {hasGlyph(separatorGlyph) ? (
        <span className={styles.separator} data-todae-glyph="" aria-hidden="true">
          {separatorGlyph}
        </span>
      ) : null}
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

function Item(props: BreadcrumbsItemProps) {
  return <ItemWithGlyph {...props} />;
}

export const Breadcrumbs = { Root, Item } as const;
