import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { cx } from './cx';
import styles from './Grid.module.css';

/**
 * A CSS grid with the density's gap, the two-axis partner to Stack. Pass
 * exactly one of `columns` or `minItemSize`. For any other track list, set
 * `gridTemplateColumns` in `style` or a class.
 */
export type GridProps = (
  | {
      /** A fixed number of equal columns. */
      columns: number;
      minItemSize?: never;
    }
  | {
      /**
       * The narrowest a column may get, as a CSS length such as "12rem". As many
       * columns fit as the width allows, and a single column never overflows.
       */
      minItemSize: string;
      columns?: never;
    }
) &
  ComponentPropsWithRef<'div'>;

export function Grid({ columns, minItemSize, className, style, ...props }: GridProps) {
  const tracks =
    minItemSize !== undefined
      ? { '--todae-grid-min-item-size': minItemSize }
      : { '--todae-grid-column-count': String(columns) };
  return (
    <div
      {...props}
      data-layout={minItemSize !== undefined ? 'fill' : 'columns'}
      className={cx(styles.root, className)}
      style={{ ...tracks, ...style } as CSSProperties}
    />
  );
}
