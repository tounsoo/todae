import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { cx } from '../internal/cx.js';
import styles from './Slider.module.css';
import { fillPercent, readScale } from './sliderRange.js';

/**
 * A native `input type="range"`. The browser handles arrow keys, Page Up and
 * Down, Home and End, and announces the value. The thumb and the filled track
 * use the slider fill token.
 */
// React's own types for value and defaultValue also take a string list, which a range input can't hold.
export type SliderRootProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'value' | 'defaultValue'> & {
  /** The value, with onChange. Use defaultValue to leave it to the input. */
  value?: number | string;
  /** The starting value, when the input keeps it. */
  defaultValue?: number | string;
};

function Root({ className, style, min, max, value, defaultValue, ...props }: SliderRootProps) {
  const scale = readScale({ min, max });
  const fill = { ...style, '--_value': fillPercent(value ?? defaultValue, scale) } as CSSProperties;
  return (
    <input
      {...props}
      type="range"
      min={min}
      max={max}
      value={value}
      defaultValue={defaultValue}
      style={fill}
      className={cx(styles.root, className)}
    />
  );
}

export const Slider = { Root } as const;
