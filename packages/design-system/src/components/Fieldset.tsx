import { useContext, useMemo, type ComponentPropsWithRef, type ReactNode } from 'react';
import { FieldsetContext } from './Fieldset.context';
import { cx } from './props';
import styles from './Fieldset.module.css';

/**
 * A native `<fieldset>`. `disabled` disables every form control inside it,
 * natively. `invalid` marks the Todae controls inside it invalid; point
 * `aria-describedby` at an ErrorMessage to say why.
 */
export type FieldsetRootProps = {
  disabled?: boolean;
  invalid?: boolean;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<'fieldset'>, 'disabled'>;

export type FieldsetLegendProps = ComponentPropsWithRef<'legend'>;

function Root({ disabled, invalid, className, ...props }: FieldsetRootProps) {
  // A fieldset inside a disabled or invalid one is disabled or invalid too, as
  // the native disabled already is.
  const outer = useContext(FieldsetContext);
  const isDisabled = Boolean(disabled) || outer.disabled;
  const isInvalid = Boolean(invalid) || outer.invalid;
  const ctx = useMemo(() => ({ disabled: isDisabled, invalid: isInvalid }), [isDisabled, isInvalid]);
  return (
    <FieldsetContext.Provider value={ctx}>
      <fieldset
        {...props}
        disabled={disabled}
        data-disabled={isDisabled ? '' : undefined}
        data-invalid={isInvalid ? '' : undefined}
        className={cx(styles.root, className)}
      />
    </FieldsetContext.Provider>
  );
}

function Legend({ className, ...props }: FieldsetLegendProps) {
  return <legend {...props} className={cx(styles.legend, className)} />;
}

export const Fieldset = { Root, Legend } as const;
