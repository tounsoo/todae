import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './Loader.module.css';

/** `spinner` turns one arc of a ring; `dots` sends a wave through three dots, as a typing indicator does. */
export type LoaderVariant = 'spinner' | 'dots';

/**
 * A native `progress` with no value, drawn as a spinner or three dots. It
 * keeps the progressbar role, so it needs a name: wrap it in a `label` with
 * the text, or give it `aria-label`.
 */
export type LoaderRootProps = Omit<ComponentPropsWithRef<'progress'>, 'value' | 'max'> & {
  /** How it is drawn. Default `spinner`. */
  variant?: LoaderVariant;
};

function Root({ className, variant = 'spinner', ...props }: LoaderRootProps) {
  // A value would make it a determinate bar, so one passed around the type is dropped.
  const { value: _value, max: _max, ...rest } = props as ComponentPropsWithRef<'progress'>;
  return (
    <progress
      {...rest}
      data-variant={variant}
      className={cx(styles.root, className)}
    />
  );
}

export const Loader = { Root } as const;
