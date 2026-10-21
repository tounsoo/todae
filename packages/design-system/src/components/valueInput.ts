import { useCallback, useMemo, useRef, type InputHTMLAttributes, type RefCallback } from 'react';
import { BESIDE_NAMED, useFieldPresence, type FieldContextValue } from './Field.context.js';
import { registerValueInput, type ValueInputBound } from './validity.js';
import { visuallyHiddenClass } from './VisuallyHidden.js';

export type ValueInputOptions = {
  /** The native type that fits the value, so the browser validates it as that type: `date` for a date, `text` for a value of your own. */
  type: 'text' | 'number' | 'date' | 'time' | 'datetime-local';
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
  /** `min` and `max` as the field shows them, such as "Oct 7, 2026", for the message that names a bound. Without one, the raw value is named. */
  bound?: ValueInputBound;
};

export type ValueInputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref: RefCallback<HTMLInputElement>;
  'data-todae-value-input': '';
};

/** What a control wired with `getControlProps` decided, which its value input follows. */
export type WiredControl = {
  /** The Root's or the control's own `disabled`, or an `aria-disabled` control. */
  disabled: boolean;
  /** The control's `form`. */
  form: string | undefined;
  /** The control's own `name` prop, which the value input takes when the control does not send. */
  name: string | undefined;
  /** The control is a named element that sends its own value, so the value input goes without a name. */
  sends: boolean;
};

// What each value input held at its last commit, so a change can be announced.
const committed = /* @__PURE__ */ new WeakMap<HTMLInputElement, string>();

/**
 * Sets the input's value as a person's edit would, and says so with an `input`
 * event that bubbles, once the commit is over: React cannot take an event
 * during one. The first commit announces nothing.
 */
function commitValue(node: HTMLInputElement, value: string) {
  const prev = committed.get(node);
  committed.set(node, value);
  // The prototype's setter, not the element's: React's value tracking would take the write for its own and report no change.
  if (node.value !== value) Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(node, value);
  if (prev === undefined || prev === value) return;
  queueMicrotask(() => {
    if (node.isConnected) node.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/**
 * The value input half of useField. `wire` is called by getControlProps with
 * what it resolved; `track` by its ref with the control's node. Everything the
 * getter decides, it decides here: the name, `disabled`, `form` and the control
 * a problem on the input sends focus to.
 */
export function useValueInput(ctx: FieldContextValue) {
  const presence = useFieldPresence(ctx.store);
  // The control this instance wired, if any. A value input speaks for that one, else for the field's last.
  const own = useRef<HTMLElement | null>(null);
  // What that wiring resolved. Written by getControlProps in a render and read by the getter in the same one.
  const wired = useRef<WiredControl | null>(null);
  const wire = useCallback((control: WiredControl) => {
    wired.current = control;
  }, []);
  const track = useCallback((node: HTMLElement | null) => {
    own.current = node;
  }, []);
  const { inputRef, store } = ctx;
  const getValueInputProps = useCallback(
    (options: ValueInputOptions): ValueInputProps => {
      const control = wired.current;
      const owner = () => own.current ?? inputRef.current;
      const bound: ValueInputBound = options.bound ?? {};
      return {
        ref: (node) => {
          if (!node) return;
          registerValueInput(node, store, { owner, bound });
          commitValue(node, options.value);
        },
        type: options.type,
        // The field's name unless a control already took it.
        name: control?.sends ? undefined : (control?.name ?? (presence & BESIDE_NAMED ? undefined : ctx.name)),
        defaultValue: options.value,
        required: options.required,
        min: options.min,
        max: options.max,
        step: options.step,
        disabled: control ? control.disabled : ctx.disabled,
        form: control?.form,
        // Not readOnly or hidden: the browser leaves both out of validation.
        autoComplete: 'off',
        tabIndex: -1,
        'aria-hidden': true,
        'data-todae-value-input': '',
        className: visuallyHiddenClass(),
        // The browser's own check outside a Form.Root focuses the input; the person's control is where focus belongs.
        onFocus: () => owner()?.focus(),
      };
    },
    [ctx.disabled, ctx.name, inputRef, presence, store],
  );
  return useMemo(() => ({ wire, track, presence, getValueInputProps }), [wire, track, presence, getValueInputProps]);
}
