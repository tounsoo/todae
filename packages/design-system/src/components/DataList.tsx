import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { cx } from './cx.js';
import styles from './DataList.module.css';

export type DataListOrientation = 'horizontal' | 'vertical';

/**
 * A native `dl` for key and value pairs, such as a settings pane, an order summary or a profile.
 * `orientation` sets whether each term sits beside its details or above them.
 */
export type DataListRootProps = {
  orientation?: DataListOrientation;
  /**
   * Lays the items out in columns no narrower than this CSS length, such as
   * "24rem". As many columns fit as the width allows, with
   * `datalist.gap.between-columns` between them, and a single column never
   * overflows. A horizontal item stacks in a column narrower than its term
   * column, `datalist.gap.column` and details minimum together. Without it the
   * items sit in one column.
   */
  minItemSize?: string;
} & ComponentPropsWithRef<'dl'>;
/** A `div` that groups one term with its details, valid inside a `dl`. */
export type DataListItemProps = ComponentPropsWithRef<'div'>;
/** A native `dt`, the term for the details beside or below it. */
export type DataListTermProps = ComponentPropsWithRef<'dt'>;
/** A native `dd`, the value for the term in the same item. */
export type DataListDetailsProps = ComponentPropsWithRef<'dd'>;

function Root({ orientation = 'horizontal', minItemSize, className, style, ...props }: DataListRootProps) {
  return (
    <dl
      {...props}
      data-orientation={orientation}
      data-layout={minItemSize ? 'fill' : undefined}
      className={cx(styles.root, className)}
      style={minItemSize ? ({ '--_min-item-size': minItemSize, ...style } as CSSProperties) : style}
    />
  );
}

function Item({ className, ...props }: DataListItemProps) {
  return <div {...props} className={cx(styles.item, className)} />;
}

function Term({ className, ...props }: DataListTermProps) {
  return <dt {...props} className={cx(styles.term, className)} />;
}

function Details({ className, ...props }: DataListDetailsProps) {
  return <dd {...props} className={cx(styles.details, className)} />;
}

export const DataList = { Root, Item, Term, Details } as const;
