import type { ComponentPropsWithRef } from 'react';
import { cx } from '../internal/cx.js';
import styles from './Slider.module.css';

/**
 * A native `input type="range"`. The browser handles arrow keys, Page Up and
 * Down, Home and End, and announces the value; accent-color tints it.
 */
// React's own types for value and defaultValue also take a string list, which a range input can't hold.
export type SliderRootProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'value' | 'defaultValue'> & {
  /** The value, with onChange. Use defaultValue to leave it to the input. */
  value?: number | string;
  /** The starting value, when the input keeps it. */
  defaultValue?: number | string;
};

function Root({ className, ...props }: SliderRootProps) {
  return <input {...props} type="range" className={cx(styles.root, className)} />;
}

export const Slider = { Root } as const;
