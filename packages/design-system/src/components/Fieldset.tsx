import { useContext, useLayoutEffect, useMemo, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { FieldsetContext, FieldsetLegendContext, useFieldsetState } from './Fieldset.context';
import { cx, useComposedRefs } from './props';
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
  // A fieldset inside a disabled one is disabled too, as natively, and inside
  // an invalid one is invalid unless it sets invalid={false}.
  const outer = useContext(FieldsetContext);
  const { disabled: isDisabled, invalid: isInvalid } = useFieldsetState({ disabled, invalid });
  const ctx = useMemo(() => ({ disabled: isDisabled, invalid: isInvalid }), [isDisabled, isInvalid]);
  return (
    <FieldsetContext.Provider value={ctx}>
      <FieldsetLegendContext.Provider value={outer}>
        <fieldset
          {...props}
          disabled={disabled}
          data-disabled={isDisabled ? '' : undefined}
          data-invalid={isInvalid ? '' : undefined}
          className={cx(styles.root, className)}
        />
      </FieldsetLegendContext.Provider>
    </FieldsetContext.Provider>
  );
}

/**
 * Controls inside the legend stay enabled when only this fieldset is
 * disabled, as natively. The browser exempts only the fieldset's first
 * <legend> child, so a Legend anywhere else follows the fieldset.
 */
function Legend({ className, ref, ...props }: FieldsetLegendProps) {
  const exempt = useContext(FieldsetLegendContext);
  const fieldset = useContext(FieldsetContext);
  const [rendered, setRendered] = useState(true);
  const legendRef = useRef<HTMLLegendElement>(null);
  const refs = useComposedRefs(legendRef, ref);
  // Every commit: a legend added before this one takes the exemption from it.
  // The same value bails out, so this settles after one pass.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const node = legendRef.current;
    const parent = node?.parentElement;
    setRendered(parent?.tagName === 'FIELDSET' && parent.querySelector(':scope > legend') === node);
  });
  return (
    <FieldsetContext.Provider value={rendered ? exempt : fieldset}>
      <legend {...props} ref={refs} className={cx(styles.legend, className)} />
    </FieldsetContext.Provider>
  );
}

export const Fieldset = { Root, Legend } as const;
