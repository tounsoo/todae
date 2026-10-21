import { useContext, useLayoutEffect, useMemo, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useCustomValidity } from './customValidity.js';
import { FieldsetContext, FieldsetLegendContext, useFieldsetState } from './Fieldset.context.js';
import { ValidationScopeContext } from './Form.context.js';
import { mergeDescribedBy } from './Field.context.js';
import { cx, useComposedRefs } from './props.js';
import { carriersIn } from './Form.model.js';
import { useValidationScope } from './ValidationScope.js';
import styles from './Fieldset.module.css';

/**
 * A native `<fieldset>`. `disabled` disables every form control inside it,
 * natively. `invalid` marks the Todae controls inside it invalid; point
 * `aria-describedby` at an ErrorMessage to say why. Inside a Form.Root it is a
 * validation scope: its controls' native problems show in an
 * `ErrorMessage.Root` with no `id`.
 */
export type FieldsetRootProps = {
  disabled?: boolean;
  invalid?: boolean;
  /**
   * A message for a rule the browser can't check, set with
   * `setCustomValidity` on the fieldset's own first control that takes part in
   * validation, or, when all its controls sit in nested groups, on the first
   * one at any depth, where its error shows. An empty string or undefined means
   * the rule holds.
   */
  customValidity?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<'fieldset'>, 'disabled'>;

export type FieldsetLegendProps = ComponentPropsWithRef<'legend'>;

function Root({
  disabled,
  invalid,
  customValidity,
  className,
  ref,
  'aria-describedby': describedBy,
  onChangeCapture,
  onFocus,
  onBlur,
  ...props
}: FieldsetRootProps) {
  // A fieldset inside a disabled one is disabled too, as natively, and inside
  // an invalid one is invalid unless it sets invalid={false}.
  const outer = useContext(FieldsetContext);
  const { disabled: isDisabled, invalid: isInvalid } = useFieldsetState({ disabled, invalid });
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const refs = useComposedRefs(fieldsetRef, ref);
  const scope = useValidationScope(fieldsetRef, { onChangeCapture, onFocus, onBlur }, { describesElement: true });
  useCustomValidity(
    fieldsetRef,
    () => {
      const node = fieldsetRef.current;
      // Its own first validating control, else the first at any depth, whose error shows where that control's does.
      return node ? (carriersIn(node, { own: true })[0] ?? carriersIn(node, { own: false })[0]) : null;
    },
    customValidity,
    'Fieldset.Root',
  );
  const inner = useMemo(
    () => ({ disabled: isDisabled, invalid: isInvalid, errorId: outer.errorId }),
    [isDisabled, isInvalid, outer.errorId],
  );
  const { extend } = scope;
  const ctx = useMemo(() => extend(inner), [extend, inner]);
  return (
    <ValidationScopeContext.Provider value={scope.value}>
      <FieldsetContext.Provider value={ctx}>
        <FieldsetLegendContext.Provider value={outer}>
          <fieldset
            {...props}
            {...scope.props}
            ref={refs}
            aria-describedby={mergeDescribedBy(describedBy, scope.errorId)}
            disabled={disabled}
            data-disabled={isDisabled ? '' : undefined}
            data-invalid={ctx.invalid ? '' : undefined}
            className={cx(styles.root, className)}
          />
        </FieldsetLegendContext.Provider>
      </FieldsetContext.Provider>
    </ValidationScopeContext.Provider>
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
