import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './Separator.module.css';

/** A native `hr`, the thematic break between groups of content. It keeps the separator role. */
export type SeparatorRootProps = ComponentPropsWithRef<'hr'>;

function Root({ className, ...props }: SeparatorRootProps) {
  return <hr {...props} className={cx(styles.root, className)} />;
}

export const Separator = { Root } as const;
