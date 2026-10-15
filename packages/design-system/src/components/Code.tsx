import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './Code.module.css';

/** A native `code`: inline code that keeps the text color around it and tints its box from that color. */
export type CodeRootProps = ComponentPropsWithRef<'code'>;
/** A native `pre`: a block that scrolls sideways when a line is too long. A `code` inside it drops its own box. */
export type CodeBlockProps = ComponentPropsWithRef<'pre'>;

function Root({ className, ...props }: CodeRootProps) {
  return <code {...props} className={cx(styles.root, className)} />;
}

function Block({ className, ...props }: CodeBlockProps) {
  return <pre {...props} className={cx(styles.block, className)} />;
}

export const Code = { Root, Block } as const;
