import { useCallback, type Ref } from 'react';
import { inputLabel, mergeDescribedBy, useFieldContext } from '../components/Field.context';
import { composeRefs } from '../components/props';

/** `id` and `name` are not taken here: they come from `Field.Root`, which a `Label htmlFor` and the form use. */
export type FieldControlUserProps = {
  ref?: Ref<HTMLElement | null>;
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
  'aria-disabled': true | undefined;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
  'aria-label': string | undefined;
  'aria-labelledby': string | undefined;
  'data-todae-field-control': '';
};

export type UseFieldResult = {
  /** The id a `Label htmlFor` points at. */
  id: string;
  name: string | undefined;
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
  const ctx = useFieldContext();
  const { inputRef } = ctx;
  const setControl = useCallback(
    (node: HTMLElement | null) => {
      inputRef.current = node;
    },
    [inputRef],
  );
  const getControlProps = useCallback(
    <P extends FieldControlUserProps>(
      props?: P,
      { native = true }: FieldControlOptions = {},
    ): Omit<P, keyof FieldControlWire> & FieldControlWire => {
      const user = (props ?? {}) as P;
      return {
        ...user,
        ref: user.ref ? composeRefs(setControl, user.ref) : setControl,
        id: ctx.inputId,
        name: native ? ctx.name : undefined,
        disabled: native ? ctx.disabled : undefined,
        'aria-disabled': !native && ctx.disabled ? true : undefined,
        'aria-invalid': ctx.invalid || undefined,
        'aria-describedby': mergeDescribedBy(ctx.describedBy, user['aria-describedby']),
        ...inputLabel(user, ctx),
        'data-todae-field-control': '',
      } as Omit<P, keyof FieldControlWire> & FieldControlWire;
    },
    [ctx, setControl],
  );
  return {
    id: ctx.inputId,
    name: ctx.name,
    disabled: ctx.disabled,
    invalid: ctx.invalid,
    getControlProps,
  };
}
