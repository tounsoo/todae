import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './VisuallyHidden.module.css';

/** The class that hides an element the way `VisuallyHidden.Root` does, for an element that is not a span, such as a value input. */
export const visuallyHiddenClass = () => styles.root;

/**
 * Hides its content on screen and keeps it for assistive technology. A `span`,
 * so it fits inside a button or a line of text.
 */
export type VisuallyHiddenRootProps = {
  /** Shows the content again while focus is on it or inside it, for skip links. */
  focusable?: boolean;
} & ComponentPropsWithRef<'span'>;

function Root({ focusable = false, className, ...props }: VisuallyHiddenRootProps) {
  return <span {...props} className={cx(focusable ? styles.focusable : styles.root, className)} />;
}

export const VisuallyHidden = { Root } as const;
