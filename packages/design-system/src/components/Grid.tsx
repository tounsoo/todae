import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { cx } from './cx';
import styles from './Grid.module.css';

/**
 * A CSS grid with the density's gap, the two-axis partner to Stack. Pass at
 * most one of `columns` or `minItemSize`. With neither, set the tracks
 * yourself with `gridTemplateColumns` in `style` or a class.
 */
export type GridProps = (
  | {
      /** A fixed number of equal columns, a whole number from 1. */
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
  | { columns?: never; minItemSize?: never }
) &
  ComponentPropsWithRef<'div'>;

export function Grid({ columns, minItemSize, className, style, ...props }: GridProps) {
  const layout = minItemSize ? 'fill' : columns !== undefined ? 'columns' : undefined;
  const tracks =
    layout === 'fill'
      ? { '--todae-grid-min-item-size': minItemSize }
      : layout === 'columns'
        ? { '--todae-grid-column-count': String(Number.isFinite(Number(columns)) ? Math.max(1, Math.floor(Number(columns))) : 1) }
        : undefined;
  return (
    <div
      {...props}
      data-layout={layout}
      className={cx(styles.root, className)}
      style={tracks ? ({ ...tracks, ...style } as CSSProperties) : style}
    />
  );
}
