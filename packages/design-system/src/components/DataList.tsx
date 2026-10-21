import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './DataList.module.css';

export type DataListOrientation = 'horizontal' | 'vertical';

/**
 * A native `dl` for key and value pairs, such as a settings pane, an order summary or a profile.
 * `orientation` sets whether each term sits beside its details or above them.
 */
export type DataListRootProps = { orientation?: DataListOrientation } & ComponentPropsWithRef<'dl'>;
/** A `div` that groups one term with its details, valid inside a `dl`. */
export type DataListItemProps = ComponentPropsWithRef<'div'>;
/** A native `dt`, the name of the value beside or below it. */
export type DataListTermProps = ComponentPropsWithRef<'dt'>;
/** A native `dd`, the value for the term in the same item. */
export type DataListDetailsProps = ComponentPropsWithRef<'dd'>;

function Root({ orientation = 'horizontal', className, ...props }: DataListRootProps) {
  return <dl {...props} data-orientation={orientation} className={cx(styles.root, className)} />;
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
