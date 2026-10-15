import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './Progress.module.css';

/**
 * A native `meter`: a measurement within a known range. Set `low`, `high` and
 * `optimum`, and the browser decides whether the value is good, fair or poor.
 */
export type MeterRootProps = ComponentPropsWithRef<'meter'>;

function Root({ className, ...props }: MeterRootProps) {
  return <meter {...props} className={cx(styles.root, styles.meter, className)} />;
}

export const Meter = { Root } as const;
