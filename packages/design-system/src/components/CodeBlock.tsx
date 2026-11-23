import type { ComponentPropsWithRef } from 'react';
import { cx } from '../internal/cx.js';
import styles from './CodeBlock.module.css';

/** A native `pre`: a block that scrolls sideways when a line is too long. A `code` inside it drops its own box. */
export type CodeBlockRootProps = {
  /** Wraps long lines instead of scrolling sideways. */
  wrap?: boolean;
} & ComponentPropsWithRef<'pre'>;

function Root({ wrap, className, ...props }: CodeBlockRootProps) {
  return <pre {...props} data-wrap={wrap ? '' : undefined} className={cx(styles.root, className)} />;
}

export const CodeBlock = { Root } as const;
