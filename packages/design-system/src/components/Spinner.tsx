import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import styles from './Spinner.module.css';

/**
 * A native `progress` with no value, drawn as a turning ring. It keeps the
 * progressbar role, so it needs a name: wrap it in a `label` with the text, or
 * give it `aria-label`.
 */
export type SpinnerRootProps = Omit<ComponentPropsWithRef<'progress'>, 'value' | 'max'>;

function Root({ className, ...props }: SpinnerRootProps) {
  // A value would make it a determinate bar, so one passed around the type is dropped.
  const { value: _value, max: _max, ...rest } = props as ComponentPropsWithRef<'progress'>;
  return <progress {...rest} className={cx(styles.root, className)} />;
}

export const Spinner = { Root } as const;
