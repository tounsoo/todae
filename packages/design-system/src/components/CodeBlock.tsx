import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './CodeBlock.module.css';

/** A native `pre`: a block that scrolls sideways when a line is too long. A `code` inside it drops its own box. */
export type CodeBlockRootProps = ComponentPropsWithRef<'pre'>;

function Root({ className, ...props }: CodeBlockRootProps) {
  return <pre {...props} className={cx(styles.root, className)} />;
}

export const CodeBlock = { Root } as const;
