import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import styles from './Slider.module.css';

/**
 * A native `input type="range"`. The browser handles arrow keys, Page Up and
 * Down, Home and End, and announces the value; accent-color tints it.
 */
export type SliderRootProps = Omit<ComponentPropsWithRef<'input'>, 'type'>;

function Root({ className, ...props }: SliderRootProps) {
  return <input {...props} type="range" className={cx(styles.root, className)} />;
}

export const Slider = { Root } as const;
