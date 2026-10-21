import { useCallback, useMemo, type Ref } from 'react';
import {
  inputLabel,
  mergeDescribedBy,
  useControlPresence,
  useControlSetter,
  useFieldContext,
} from '../components/Field.context.js';
import { useStableComposedRef } from '../components/props.js';

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
  /** `name` when the control took the field's name, so a Field.ColorPicker beside it leaves the name to it. */
  'data-todae-field-control': '' | 'name';
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
   * `{ native: false }` for a control that is not a native form element.
   */
  getControlProps: <P extends FieldControlUserProps>(
    props?: P,
    options?: FieldControlOptions,
  ) => Omit<P, keyof FieldControlWire> & FieldControlWire;
};

/**
 * Joins a custom control to the nearest `Field.Root`, the way `Field.TextInput`
 * joins it. Throws outside `Field.Root`.
 */
export function useField(): UseFieldResult {
  return useFieldControl(true);
}

/**
 * useField, with `counted` false for a control that leaves the field to any
 * other control beside it, as Field.ColorPicker, Field.DatePicker, Field.DateRangePicker, Field.TimePicker and Field.DateTimePicker do. Not exported from the
 * package.
 */
export function useFieldControl(counted: boolean): UseFieldResult {
  const ctx = useFieldContext();
  const { inputRef } = ctx;
  const setFocusTarget = useControlSetter(inputRef);
  const setPresence = useControlPresence(ctx.store, counted);
  const setControl = useCallback(
    (node: HTMLElement | null) => {
      setFocusTarget(node);
      setPresence(node);
    },
    [setFocusTarget, setPresence],
  );
  const composedRef = useStableComposedRef(setControl);
  const getControlProps = useCallback(
    <P extends FieldControlUserProps>(
      props?: P,
      { native = true }: FieldControlOptions = {},
    ): Omit<P, keyof FieldControlWire> & FieldControlWire => {
      const user = (props ?? {}) as P;
      const disabled = ctx.disabled || Boolean(user.disabled);
      const name = native ? (user.name ?? ctx.name) : undefined;
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
        'data-todae-field-control': name !== undefined && name === ctx.name ? 'name' : '',
      } as Omit<P, keyof FieldControlWire> & FieldControlWire;
    },
    [composedRef, ctx],
  );
  return useMemo(
    () => ({ id: ctx.inputId, name: ctx.name, disabled: ctx.disabled, invalid: ctx.invalid, getControlProps }),
    [ctx.disabled, ctx.inputId, ctx.invalid, ctx.name, getControlProps],
  );
}
