import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type InputHTMLAttributes,
  type Ref,
  type RefCallback,
} from 'react';
import {
  inputLabel,
  mergeDescribedBy,
  useControlPresence,
  useControlSetter,
  useFieldContext,
} from '../components/Field.context.js';
import { useRevalidate } from '../components/Form.context.js';
import { useStableComposedRef } from '../components/props.js';
import { boundText, registerValueInput } from '../components/validity.js';
import visuallyHidden from '../components/VisuallyHidden.module.css';

function noop() {}

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

export type ValueInputOptions = {
  /** The native type that fits the value, so the browser validates it as that type: `date` for a date, `text` for a value of your own. */
  type: 'text' | 'number' | 'date' | 'time' | 'datetime-local' | 'color';
  /** The value in that type's format, such as `2026-10-07` for `date`. `''` for none. */
  value: string;
  /** The value may not be `''`. */
  required?: boolean;
  /** The lowest value, in the type's format. */
  min?: string;
  /** The highest value, in the type's format. */
  max?: string;
  /** The type's `step`, such as `any` to accept every value. */
  step?: string;
  /** Writes a `min` or `max` in the field's own format, such as "Oct 7, 2026", for the message that names it. Without it, the raw value is named. */
  bound?: (raw: string) => string;
};

export type ValueInputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref: RefCallback<HTMLInputElement>;
  'data-todae-value-input': '';
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
  /**
   * Props for a native `<input>` that carries a non-native control's value: it
   * submits under the field's name, and the browser validates it, so
   * `required`, `min` and `max` work and `Form.Root` shows and focuses the
   * control. Render it beside the control. It is hidden from sight and from
   * assistive technology, is not a tab stop and never takes a press. A problem
   * on it moves focus to the field's control, the one `getControlProps` wired.
   */
  getValueInputProps: (options: ValueInputOptions) => ValueInputProps;
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
 * other control beside it, as Field.ColorPicker, Field.DatePicker, Field.TimePicker and Field.DateTimePicker do. Not exported from the
 * package.
 */
export function useFieldControl(counted: boolean): UseFieldResult {
  const ctx = useFieldContext();
  const { inputRef } = ctx;
  const setFocusTarget = useControlSetter(inputRef);
  const setPresence = useControlPresence(ctx.store, counted);
  useRevalidate();
  // Whether a control already took the field's name; the value input then goes without one.
  const named = ctx.store.named > 0;
  const watching = useRef<boolean | null>(null);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    const listener = () => {
      if (watching.current !== null && watching.current !== ctx.store.named > 0) rerender();
    };
    ctx.store.presence.add(listener);
    // A control that mounted before this effect ran has already announced itself.
    listener();
    return () => {
      ctx.store.presence.delete(listener);
    };
  }, [ctx.store]);
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
  const valueInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (node) registerValueInput(node, ctx.inputRef);
    },
    [ctx.inputRef],
  );
  // The latest bound, read when a message needs it, so a new function each render registers nothing new.
  const bound = useRef<ValueInputOptions['bound']>(undefined);
  const boundRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (node) boundText.set(node, (raw) => bound.current?.(raw) ?? raw);
      valueInputRef(node);
    },
    [valueInputRef],
  );
  const getValueInputProps = useCallback(
    (options: ValueInputOptions): ValueInputProps => {
      bound.current = options.bound;
      watching.current = named;
      return {
        ref: boundRef,
        type: options.type,
        name: named ? undefined : ctx.name,
        value: options.value,
        required: options.required,
        min: options.min,
        max: options.max,
        step: options.step,
        disabled: ctx.disabled,
        // Not readOnly or hidden: the browser leaves both out of validation. The change handler only keeps React from calling the value uncontrolled.
        onChange: noop,
        tabIndex: -1,
        'aria-hidden': true,
        'data-todae-value-input': '',
        className: visuallyHidden.root,
      };
    },
    [boundRef, ctx.disabled, ctx.name, named],
  );
  return useMemo(
    () => ({
      id: ctx.inputId,
      name: ctx.name,
      disabled: ctx.disabled,
      invalid: ctx.invalid,
      getControlProps,
      getValueInputProps,
    }),
    [ctx.disabled, ctx.inputId, ctx.invalid, ctx.name, getControlProps, getValueInputProps],
  );
}
