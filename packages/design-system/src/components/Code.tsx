import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './Code.module.css';

export type CodeAs = 'code' | 'pre';

/**
 * A native `code`: inline code that keeps the text color around it and tints its box from that color.
 * With `as="pre"`, a native `pre`: a block that scrolls sideways when a line is too long, and a `code` inside it drops its own box.
 */
export type CodeRootProps =
  | ({ as?: 'code' } & ComponentPropsWithRef<'code'>)
  | ({ as: 'pre' } & ComponentPropsWithRef<'pre'>);

function Root(props: CodeRootProps) {
  if (props.as === 'pre') {
    const { as: _as, className, ...rest } = props;
    return <pre {...rest} className={cx(styles.block, className)} />;
  }
  const { as: _as, className, ...rest } = props;
  return <code {...rest} className={cx(styles.root, className)} />;
}

export const Code = { Root } as const;
