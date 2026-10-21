import { useCallback, useContext, useMemo, useRef, type InputHTMLAttributes, type RefCallback } from 'react';
import { useBesideNamed, type FieldContextValue } from './Field.context.js';
import { FormContext, ValidationScopeContext } from './Form.context.js';
import { registerValueInput, type ValueInputBound } from './validity.js';
import { visuallyHiddenClass } from './VisuallyHidden.js';

export type ValueInputOptions = {
  /** The native type that fits the value, so the browser validates it as that type: `date` for a date, `text` for a value of your own. */
  type: 'text' | 'number' | 'date' | 'time' | 'datetime-local';
  /** The value in that type's format, such as `2026-10-07` for `date`. `''` for none. */
  value: string;
  /** The name the value is sent under, instead of the field's. */
  name?: string;
  /** The value may not be `''`. */
  required?: boolean;
  /** The lowest value, in the type's format. */
  min?: string;
  /** The highest value, in the type's format. */
  max?: string;
  /** The type's `step`, such as `any` to accept every value. */
  step?: string;
  /** `min` and `max` as the field shows them, such as "Oct 7, 2026", for the message that names a bound. Without one, the raw value is named. */
  bound?: ValueInputBound;
};

declare const fromGetControlProps: unique symbol;

/** What only `getControlProps` produces, so a value input can't be handed props that never went through it. Type only: it adds nothing at run time. */
export type ControlBrand = { readonly [fromGetControlProps]: true };

/** The props of the control the value input speaks for, as `getControlProps` returned them. */
export type ValueInputControl = ControlBrand & {
  /** A control with a name sends its own value, so the value input goes without one. */
  name?: string;
  disabled?: boolean;
  'aria-disabled'?: boolean | 'true' | 'false';
  form?: string;
};

export type ValueInputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref: RefCallback<HTMLInputElement>;
  'data-todae-value-input': '';
};

const noop = () => {};

/**
 * The value input half of useField. `track` is called by the control's ref with
 * its node: the control the input speaks for, which the input sends focus to.
 * Everything the getter decides, it decides here, from the control's props and
 * what the field holds: the name, `disabled` and `form`.
 */
export function useValueInput(ctx: FieldContextValue, ownNamed: () => number) {
  // The one fact the name decision needs: a control re-renders when it flips, not each time another control mounts, and not for the name its own control took.
  const named = useBesideNamed(ctx.store, ownNamed);
  const form = useContext(FormContext);
  const scope = useContext(ValidationScopeContext);
  const own = useRef<HTMLElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const track = useCallback((node: HTMLElement | null) => {
    own.current = node;
  }, []);
  const owner = useCallback(() => own.current, []);
  const { disabled, name: fieldName, store } = ctx;
  // The ref changes only when a bound does, so React does not detach and attach it on every render. A memo of the last one, not state.
  const lastRef = useRef<{ key: string; ref: RefCallback<HTMLInputElement> } | null>(null);
  const refFor = useCallback(
    (bound: ValueInputBound) => {
      const key = JSON.stringify([bound.min, bound.max]);
      if (lastRef.current?.key !== key) {
        lastRef.current = {
          key,
          ref: (node) => {
            input.current = node;
            if (node) registerValueInput(node, { field: store, owner, bound });
          },
        };
      }
      return lastRef.current.ref;
    },
    [owner, store],
  );
  const getValueInputProps = useCallback(
    (options: ValueInputOptions, control: ValueInputControl): ValueInputProps => ({
      ref: refFor(options.bound ?? {}),
      type: options.type,
      // The field's name unless a control already took it.
      name: control.name !== undefined ? undefined : (options.name ?? (named ? undefined : fieldName)),
      // Controlled, so a value the product sets fires no event: only a person's edit does, through notifyValueChange.
      value: options.value,
      onChange: noop,
      required: options.required,
      min: options.min,
      max: options.max,
      step: options.step,
      disabled: disabled || Boolean(control.disabled) || control['aria-disabled'] === true || control['aria-disabled'] === 'true',
      form: control.form,
      // Not readOnly or hidden: the browser leaves both out of validation.
      autoComplete: 'off',
      tabIndex: -1,
      'aria-hidden': true,
      'data-todae-value-input': '',
      className: visuallyHiddenClass(),
      // The browser's own check outside a Form.Root focuses the input; the person's control is where focus belongs, and a field with none keeps no focus here.
      onFocus: (event) => (own.current ? own.current.focus() : event.currentTarget.blur()),
    }),
    [disabled, fieldName, named, refFor],
  );
  const formEdited = form?.edited;
  const touch = scope?.touch;
  const notifyValueChange = useCallback(() => {
    // The names a server error may be filed under: the field's, and what the control and the value input send.
    const names = [fieldName, (own.current as Partial<HTMLInputElement> | null)?.name, input.current?.name];
    formEdited?.([...new Set(names.filter((name): name is string => Boolean(name)))]);
    touch?.();
  }, [fieldName, formEdited, touch]);
  return useMemo(() => ({ track, getValueInputProps, notifyValueChange }), [track, getValueInputProps, notifyValueChange]);
}
