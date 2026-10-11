import type { HTMLAttributes, Ref } from 'react';
import { cx } from './cx';
import styles from './Stack.module.css';

export type StackDirection = 'row' | 'column';
export type StackAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';
export type StackJustify = 'start' | 'center' | 'end' | 'between';
export type StackGap = 'none' | 'condensed' | 'normal' | 'spacious';
export type StackAs = 'div' | 'ul' | 'ol' | 'nav' | 'section' | 'header' | 'footer';

export type StackRootProps = {
  direction?: StackDirection;
  /** Space between items. `condensed`, `normal` and `spacious` follow the density; `none` is no space. */
  gap?: StackGap;
  /** Lets items wrap onto more lines. */
  wrap?: boolean;
  /** Cross-axis alignment. Omitted, items stretch. */
  align?: StackAlign;
  /** Main-axis distribution. Omitted, items pack at the start. */
  justify?: StackJustify;
  /** The element to render. A `ul` or `ol` loses its bullets and indent and keeps `role="list"`. */
  as?: StackAs;
  ref?: Ref<HTMLElement>;
} & HTMLAttributes<HTMLElement>;

function Root({ direction = 'column', gap = 'normal', wrap, align, justify, as: Tag = 'div', className, ref, ...props }: StackRootProps) {
  const list = Tag === 'ul' || Tag === 'ol';
  return (
    <Tag
      {...props}
      // Safari drops list semantics from a list without bullets unless the role is explicit.
      role={props.role ?? (list ? 'list' : undefined)}
      // Each tag's element type extends HTMLElement; the ref is typed to the common base.
      ref={ref as Ref<HTMLDivElement & HTMLUListElement & HTMLOListElement>}
      data-gap={gap === 'normal' ? undefined : gap}
      data-wrap={wrap ? '' : undefined}
      data-align={align}
      data-justify={justify}
      className={cx(styles.root, styles[direction], list && styles.list, className)}
    />
  );
}

export const Stack = { Root } as const;
