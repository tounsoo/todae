import { useCallback, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import { inputLabel, mergeDescribedBy, useFieldContext } from './Field.context.js';
import type { FieldControlRole } from './fieldRegistry.js';
import { useRevalidate } from './Form.context.js';
import { useStableComposedRef } from '../internal/props.js';
import {
  useValueInput,
  type ControlBrand,
  type ValueInputControl,
  type ValueInputOptions,
  type ValueInputProps,
} from './valueInput.js';

export type { ValueInputControl, ValueInputOptions, ValueInputProps };

/** `id` and `name` are not taken here: they come from `Field.Root`, which a `Label htmlFor` and the form use. */
export type FieldControlUserProps = {
  ref?: Ref<HTMLElement | null>;
  /** The control's own name, used instead of the Root's. */
  name?: string;
  /** Disables the control on top of the Root's `disabled`. */
  disabled?: boolean;
  /** The control's own, for one that stays focusable while unavailable. Kept unless the Field disables a non-native control. */
  'aria-disabled'?: boolean | 'true' | 'false';
  /** Marks the control invalid on top of the Root's `invalid`. */
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  'aria-describedby'?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

export type FieldControlOptions = {
  /**
   * False for a control that is not a native form element, such as a
   * `role="slider"` div: it gets `aria-disabled` instead of `disabled`, and
   * no `name`, which only a form element submits. Default true.
   */
  native?: boolean;
  /**
   * False for a control whose value a value input sends instead, such as
   * `Field.NumberInput`'s text: it gets no `name`, the Root's or its own, and
   * is not marked as having taken the field's name, so a control beside it
   * still can. Default true.
   */
  sendsName?: boolean;
};

export type FieldControlWire = {
  ref: (node: HTMLElement | null) => void;
  id: string;
  name: string | undefined;
  disabled: boolean | undefined;
  'aria-disabled': FieldControlUserProps['aria-disabled'];
  'aria-invalid': FieldControlUserProps['aria-invalid'];
  'aria-describedby': string | undefined;
  'aria-label': string | undefined;
  'aria-labelledby': string | undefined;
  /** Marks the element as the field's control, for the shell's press and focus ring. */
  'data-todae-field-control': '';
};

export type UseFieldResult = {
  /** The id a `Label htmlFor` points at. */
  id: string;
  name: string | undefined;
  /** The Root's disabled. A control that also takes its own `disabled` combines the two. */
  disabled: boolean;
  invalid: boolean;
  /**
   * Props for the one control inside `Field.Root`: id, name, disabled,
   * aria-invalid, merged aria-describedby, the Root's name unless the control
   * names itself, and a ref so a press on the shell focuses it. Pass
   * `{ native: false }` for a control that is not a native form element, and
   * `{ sendsName: false }` for one that sends nothing itself.
   */
  getControlProps: <P extends FieldControlUserProps>(
    props?: P,
    options?: FieldControlOptions,
  ) => Omit<P, keyof FieldControlWire> & FieldControlWire & ControlBrand;
  /**
   * Props for a native `<input>` that carries a non-native control's value: it
   * submits under the field's name, and the browser validates it, so
   * `required`, `min` and `max` work and `Form.Root` shows and focuses the
   * control. Render it beside the control, and pass the props
   * `getControlProps` returned for it as the second argument: the input
   * follows its `disabled` and `form`, and takes no name when that control
   * sent one. It is hidden from sight and from assistive technology, is not a
   * tab stop and never takes a press. A problem on it moves focus to the
   * control that `getControlProps` wired.
   */
  getValueInputProps: (options: ValueInputOptions, control: ValueInputControl) => ValueInputProps;
  /**
   * Call it when a person changes the control's value in a way that fires no
   * change event on a native element, such as a pick or a removed chip. It
   * hides the field's server error in `Form.Root`, ends the wait for a reply
   * and counts the field as edited, as typing in a text input does. A value
   * your code sets is no edit, so don't call it for one.
   */
  notifyValueChange: () => void;
};

/**
 * Joins a custom control to the nearest `Field.Root`, the way `Field.TextInput`
 * joins it. Throws outside `Field.Root`.
 */
export function useField(): UseFieldResult {
  return useFieldControl({ role: 'control' });
}

/**
 * useField for a part with its own `role` in the field, as the pickers have,
 * and a picker's `toggle`, which a press on the shell calls. Not exported from
 * the package.
 */
export function useFieldControl({ role, toggle }: { role: FieldControlRole; toggle?: () => void }): UseFieldResult {
  const ctx = useFieldContext();
  const { registry } = ctx;
  // This control's key in the registry.
  const [self] = useState(() => ({}));
  const node = useRef<HTMLElement | null>(null);
  const valueInput = useValueInput(ctx, self, node);
  useRevalidate();
  // Whether the props getControlProps last gave out send the field's name. The registry hears it on attach and after each commit, never during render.
  const takesName = useRef(false);
  const register = useCallback(() => {
    const el = node.current;
    registry.setControl(self, el && { node: el, role, takesName: takesName.current, toggle });
  }, [registry, role, self, toggle]);
  const setControl = useCallback(
    (el: HTMLElement | null) => {
      node.current = el;
      register();
    },
    [register],
  );
  // After each commit: whether the control took the field's name can change without a new node.
  useLayoutEffect(() => register());
  const composedRef = useStableComposedRef(setControl);
  const getControlProps = useCallback(
    <P extends FieldControlUserProps>(
      props?: P,
      { native = true, sendsName = true }: FieldControlOptions = {},
    ): Omit<P, keyof FieldControlWire> & FieldControlWire & ControlBrand => {
      const user = (props ?? {}) as P;
      const disabled = ctx.disabled || Boolean(user.disabled);
      const name = native && sendsName ? (user.name ?? ctx.name) : undefined;
      takesName.current = name !== undefined && name === ctx.name;
      return {
        ...user,
        ref: composedRef(user.ref),
        id: ctx.inputId,
        name,
        disabled: native ? disabled : undefined,
        // A control's own aria-disabled stays unless the Field disables it.
        'aria-disabled': !native && disabled ? true : user['aria-disabled'],
        // The Root's invalid wins; otherwise the control's own value, such as `spelling`, stays.
        'aria-invalid': ctx.invalid ? true : user['aria-invalid'],
        'aria-describedby': mergeDescribedBy(ctx.describedBy, user['aria-describedby']),
        ...inputLabel(user, ctx),
        'data-todae-field-control': '',
      } as unknown as Omit<P, keyof FieldControlWire> & FieldControlWire & ControlBrand;
    },
    [composedRef, ctx],
  );
  return useMemo<UseFieldResult>(
    () => ({
      id: ctx.inputId,
      name: ctx.name,
      disabled: ctx.disabled,
      invalid: ctx.invalid,
      getControlProps,
      getValueInputProps: valueInput.getValueInputProps,
      notifyValueChange: valueInput.notifyValueChange,
    }),
    [ctx.disabled, ctx.inputId, ctx.invalid, ctx.name, getControlProps, valueInput.getValueInputProps, valueInput.notifyValueChange],
  );
}
