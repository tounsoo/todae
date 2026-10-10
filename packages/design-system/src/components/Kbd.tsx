import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import styles from './Kbd.module.css';

/**
 * A native `kbd`, drawn as a key cap. For a shortcut, put one per key inside an
 * outer one, as HTML defines it: the outer one stays plain text.
 */
export type KbdRootProps = ComponentPropsWithRef<'kbd'>;

function Root({ className, ...props }: KbdRootProps) {
  return <kbd {...props} className={cx(styles.root, className)} />;
}

export const Kbd = { Root } as const;
