import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import styles from './Spinner.module.css';

/** `ring` turns one arc of a circle; `dots` sends a wave through three dots, as a typing indicator does. */
export type SpinnerVariant = 'ring' | 'dots';

/**
 * A native `progress` with no value, drawn as a turning ring or three dots. It
 * keeps the progressbar role, so it needs a name: wrap it in a `label` with
 * the text, or give it `aria-label`.
 */
export type SpinnerRootProps = Omit<ComponentPropsWithRef<'progress'>, 'value' | 'max'> & {
  /** How it is drawn. Default `ring`. */
  variant?: SpinnerVariant;
};

function Root({ className, variant = 'ring', ...props }: SpinnerRootProps) {
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

export const Spinner = { Root } as const;
