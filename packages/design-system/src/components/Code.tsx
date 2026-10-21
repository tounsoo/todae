import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './Code.module.css';

/** A native `code`: inline code that keeps the text color around it and tints its box from that color. */
export type CodeRootProps = ComponentPropsWithRef<'code'>;

function Root({ className, ...props }: CodeRootProps) {
  return <code {...props} className={cx(styles.root, className)} />;
}

export const Code = { Root } as const;
