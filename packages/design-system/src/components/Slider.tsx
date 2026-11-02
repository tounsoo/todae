import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.js';
import { mergeDescribedBy } from './Field.context.js';
import { useFieldsetState } from './Fieldset.context.js';
import { useRevalidate } from './Form.context.js';
import styles from './Slider.module.css';

/**
 * A native `input type="range"`. The browser handles arrow keys, Page Up and
 * Down, Home and End, and announces the value; accent-color tints it.
 */
export type SliderRootProps = Omit<ComponentPropsWithRef<'input'>, 'type'>;

/** `aria-invalid` as a boolean, or undefined when it is not set. */
function ownInvalid(value: SliderRootProps['aria-invalid']): boolean | undefined {
  return value === undefined ? undefined : value === true || value === 'true';
}

function Root({
  className,
  disabled: disabledProp,
  'aria-invalid': ariaInvalid,
  'aria-describedby': describedBy,
  ...props
}: SliderRootProps) {
  const { disabled, invalid, errorId } = useFieldsetState({ disabled: disabledProp, invalid: ownInvalid(ariaInvalid) });
  useRevalidate();
  return (
    <input
      {...props}
      type="range"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={mergeDescribedBy(describedBy, errorId)}
      className={cx(styles.root, className)}
    />
  );
}

export const Slider = { Root } as const;
