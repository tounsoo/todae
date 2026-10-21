import type { HTMLAttributes, Ref } from 'react';
import { cx } from './cx.js';
import styles from './Code.module.css';

export type CodeAs = 'code' | 'pre';

export type CodeRootProps = {
  /** The element to render. A `pre` is a block that scrolls sideways when a line is too long, and a `code` inside it drops its own box. */
  as?: CodeAs;
  ref?: Ref<HTMLElement>;
} & HTMLAttributes<HTMLElement>;

/** A native `code`: inline code that keeps the text color around it and tints its box from that color. */
function Root({ as: Tag = 'code', className, ref, ...props }: CodeRootProps) {
  return (
    <Tag
      {...props}
      // Each tag's element type extends HTMLElement; the ref is typed to the common base.
      ref={ref as Ref<HTMLElement & HTMLPreElement>}
      className={cx(Tag === 'pre' ? styles.block : styles.root, className)}
    />
  );
}

export const Code = { Root } as const;
