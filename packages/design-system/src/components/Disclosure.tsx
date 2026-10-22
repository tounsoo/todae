import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './Disclosure.module.css';

/**
 * A native `details`. The browser handles the keyboard and the expanded state a
 * screen reader announces. Browsers that support it also open a closed one
 * when find-in-page matches its content. Disclosures that share a `name` form
 * an exclusive accordion.
 */
export type DisclosureRootProps = ComponentPropsWithRef<'details'>;
/** A native `summary`, the always-visible toggle. Put it first in the root. */
export type DisclosureSummaryProps = ComponentPropsWithRef<'summary'>;

export function Root({ className, ...props }: DisclosureRootProps) {
  return <details {...props} className={cx(styles.root, className)} />;
}

function Summary({ className, ...props }: DisclosureSummaryProps) {
  return <summary {...props} className={cx(styles.summary, className)} />;
}

export const Disclosure = { Root, Summary } as const;
