/// <reference lib="esnext.temporal" preserve="true" />
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { activeIn } from '../internal/activeElement.js';
import { useDomId } from '../internal/domId.js';
import {
  FIELD_CONTROL_SELECTOR,
  FOCUSABLE_FIELD_CONTROL_SELECTOR,
  FieldContext,
  mergeDescribedBy,
} from './Field.context.js';
import { FieldsetContext, useFieldsetState } from './Fieldset.context.js';
import { ValidationScopeContext } from './Form.context.js';
import { useCustomValidity } from './customValidity.js';
import { useValidationScope } from './ValidationScope.js';
import { isValidityCarrier } from './validity.js';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import styles from './Field.module.css';
import { createFieldRegistry, type FieldRegistry } from './fieldRegistry.js';
import { TextInput } from './Field.TextInput.js';
import { NumberInput } from './Field.NumberInput.js';
import { OneTimeCode } from './Field.OneTimeCode.js';
import { Decrement, Increment } from './Field.StepButton.js';
import { Textarea } from './Field.Textarea.js';
import { ChipInput } from './Field.ChipInput.js';
import { Select } from './Field.Select.js';
import { DateInput } from './Field.DateInput.js';
import { TimeInput } from './Field.TimeInput.js';
import { DateTimeInput } from './Field.DateTimeInput.js';
import { DateRangeInput } from './Field.DateRangeInput.js';
import { Picker } from './Field.Picker.js';
import { Counter } from './Field.Counter.js';

/**
 * `id`, `name` and the three naming ARIA props go to the input; every other
 * native attribute lands on the shell `div`.
 */
export type FieldRootProps = {
  disabled?: boolean;
  invalid?: boolean;
  /**
   * A message for a rule the browser can't check, set with
   * `setCustomValidity` on the field's control when that is a native
   * input, select or textarea. An empty string or undefined means the rule holds.
   */
  customValidity?: string;
  id?: string;
  name?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<'div'>, 'id'>;

export type FieldIconProps = {
  children?: ReactNode;
  interactive?: boolean;
  className?: string;
} & ComponentPropsWithRef<'span'>;

export type FieldAffixProps = {
  children?: ReactNode;
  className?: string;
} & ComponentPropsWithRef<'span'>;

function Icon({ interactive, className, ...props }: FieldIconProps) {
  return (
    <span
      {...props}
      aria-hidden={props['aria-hidden'] ?? (interactive ? undefined : true)}
      className={cx(styles.adornment, styles.icon, className)}
    />
  );
}

function Affix({ className, ...props }: FieldAffixProps) {
  return <span {...props} className={cx(styles.adornment, className)} />;
}

// The control whose picker a press beside it opens: a closed select, a picker part, which registered a toggle, or the Field.Picker beside a read-only typed input.
function pickerOf(control: HTMLElement | undefined, registry: FieldRegistry): HTMLElement | null {
  if (control instanceof HTMLSelectElement) return isOpen(control) ? null : control;
  if (control && registry.toggleFor(control)) return control;
  return control && readOnlyTyped(control) ? registry.lastPicker() : null;
}

// A typed input that can't be typed in, such as a date that is only picked: a press on it opens the picker beside it.
function readOnlyTyped(node: EventTarget | null): node is HTMLInputElement {
  return node instanceof HTMLInputElement && node.readOnly && node.hasAttribute('data-todae-typed-input');
}

// Whether a select's picker is showing. A browser without `:open` throws,
// and treats the picker as closed.
function isOpen(control: HTMLSelectElement): boolean {
  try {
    return control.matches(':open');
  } catch {
    return false;
  }
}

// Walks up by class list rather than a selector, so any hashed class name works.
function inAdornment(node: HTMLElement, shell: HTMLElement): boolean {
  for (let el = node.parentElement; el && el !== shell; el = el.parentElement) {
    if (styles.adornment && el.classList.contains(styles.adornment)) return true;
  }
  return false;
}

// A press in a part's own popover, such as Field.Picker's, is not a press on the shell.
function inOwnPopover(target: EventTarget | null, shell: HTMLElement): boolean {
  const popover = target instanceof Element ? target.closest('[popover]') : null;
  return popover != null && shell.contains(popover);
}

// An icon-only Button.Root placed straight in the shell, beside the input.
function lineButtonOf(target: EventTarget | null, shell: HTMLElement): HTMLElement | null {
  const button = target instanceof Element ? target.closest<HTMLElement>(':is(button, a)[data-icon-only]') : null;
  return button?.parentElement === shell ? button : null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      `button, a, [tabindex], [contenteditable]:not([contenteditable='false']), ${FIELD_CONTROL_SELECTOR}`,
    ),
  );
}

function Root({
  disabled: disabledProp,
  invalid: invalidProp,
  customValidity,
  id,
  name,
  className,
  children,
  'aria-describedby': describedBy,
  'aria-labelledby': labelledBy,
  'aria-label': ariaLabel,
  onMouseDown: onMouseDownProp,
  onClick: onClickProp,
  ...props
}: FieldRootProps) {
  // Inside a Fieldset.Root, its disabled and invalid apply here too.
  const { disabled, invalid, errorId } = useFieldsetState({ disabled: disabledProp, invalid: invalidProp });
  const autoId = useDomId();
  const hintId = useDomId();
  const shellRef = useRef<HTMLDivElement>(null);
  const shellComposed = useComposedRefs(shellRef, props.ref);
  const pendingPicker = useRef<HTMLElement | null>(null);
  const [registry] = useState(createFieldRegistry);
  // A Root nested in this one: a press on this shell can land on its picker.
  const parentRegistry = useContext(FieldContext)?.registry;
  useLayoutEffect(() => parentRegistry?.addChild(registry), [parentRegistry, registry]);
  const inputId = id ?? autoId;
  // The control the shell focuses is the field's one native control, when it has one the browser validates, else the first input that carries the field's value: a read-only typed input is left out of a form's check, its value input is not.
  useCustomValidity(shellRef, () => {
    const control = registry.focusTarget();
    const carrier = control && isValidityCarrier(control) ? control : null;
    return carrier?.willValidate ? carrier : (registry.firstValueInput() ?? carrier);
  }, customValidity);
  const describedByWithError = mergeDescribedBy(describedBy, errorId);

  // Stable while these inputs are, so parts and useField callbacks keep their identity.
  const ctx = useMemo(
    () => ({
      inputId,
      hintId,
      disabled: Boolean(disabled),
      invalid: Boolean(invalid),
      name,
      describedBy: describedByWithError,
      labelledBy,
      ariaLabel,
      shellRef,
      registry,
    }),
    [ariaLabel, describedByWithError, disabled, hintId, inputId, invalid, labelledBy, name, registry],
  );

  function onMouseDown(event: MouseEvent<HTMLDivElement>) {
    // Only a primary press: a right or middle click keeps its own meaning.
    if (event.button !== 0 || disabled) return;
    // A press on a button in the field's line, such as a password's show button, keeps focus where
    // it is when it is in the field, so the caret stays and Safari, which doesn't focus a pressed
    // button, doesn't blur the field. Elsewhere it is a press on a button. This holds in any field;
    // the line button's size in Field.module.css applies only beside a one-line input.
    const action = lineButtonOf(event.target, event.currentTarget);
    if (action) {
      const focused = activeIn(event.currentTarget);
      if (focused !== action && focused && event.currentTarget.contains(focused) && !action.matches(':disabled')) {
        event.preventDefault();
      }
      return;
    }
    if (readOnlyTyped(event.target) && !inAdornment(event.target, event.currentTarget)) {
      // Focus goes to the input as for any press; its click opens the picker.
      pendingPicker.current = registry.lastPicker();
      return;
    }
    if (isInteractiveTarget(event.target)) return;
    if (inOwnPopover(event.target, event.currentTarget)) return;
    event.preventDefault();
    // The field's focus target is the last control to mount. If it is not usable, a control
    // still in the shell takes the press, never one inside an Icon or Affix.
    const current = registry.focusTarget();
    const usable = (node: HTMLElement) =>
      node.matches(FOCUSABLE_FIELD_CONTROL_SELECTOR) && !inAdornment(node, event.currentTarget);
    const control = current?.isConnected && usable(current)
      ? current
      : [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_FIELD_CONTROL_SELECTOR)].find(usable);
    control?.focus();
    // A press beside a select, a Field.Picker or a read-only typed input with a picker acts as a
    // press on the control would. The picker opens on click: one opened now would close again as
    // the press goes on. A select's open picker closes on this press, which
    // must not open it again; Field.Picker's toggles on the click.
    pendingPicker.current = pickerOf(control, registry);
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const picker = pendingPicker.current;
    pendingPicker.current = null;
    // Only the click that ends this press: one from the keyboard or from
    // assistive technology has no press (detail 0) and opens nothing.
    if (!picker?.isConnected || event.detail === 0) return;
    if (isInteractiveTarget(event.target) && !readOnlyTyped(event.target)) return;
    if (!(picker instanceof HTMLSelectElement)) {
      registry.toggleFor(picker)?.();
      return;
    }
    try {
      picker.showPicker?.();
    } catch {
      // Not allowed here, or not supported: focus is enough.
    }
  }

  return (
    <FieldContext.Provider value={ctx}>
      <div
        {...props}
        ref={shellComposed}
        className={cx(styles.shell, className)}
        data-disabled={disabled ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
          // Each press decides afresh whether its click opens a picker, even
          // one whose consumer handler turns the shell's handling off.
          pendingPicker.current = null;
          composeHandlers(onMouseDownProp, onMouseDown)(event);
        }}
        onClick={(event: MouseEvent<HTMLDivElement>) => {
          composeHandlers(onClickProp, onClick)(event);
          // The press's click is over, whether the shell handled it or not.
          pendingPicker.current = null;
        }}
      >
        {children}
      </div>
    </FieldContext.Provider>
  );
}

export type { FieldTextInputType, FieldTextInputProps } from './Field.TextInput.js';
export type { FieldNumberInputProps } from './Field.NumberInput.js';
export type { FieldOneTimeCodeCharacters, FieldOneTimeCodeProps } from './Field.OneTimeCode.js';
export type { FieldDecrementProps, FieldIncrementProps } from './Field.StepButton.js';
export type { FieldTextareaHighlight } from './TextareaHighlights.js';
export type { FieldTextareaProps } from './Field.Textarea.js';
export type { FieldChipInputProps } from './Field.ChipInput.js';
export type { FieldSelectProps } from './Field.Select.js';
export type { FieldDateInputProps } from './Field.DateInput.js';
export type { FieldTimeInputProps } from './Field.TimeInput.js';
export type { FieldDateTimeInputProps } from './Field.DateTimeInput.js';
export type { FieldDateRangeInputProps } from './Field.DateRangeInput.js';
export type { FieldPickerCloseReason, FieldPickerControls, FieldPickerProps } from './Field.Picker.js';
export type { FieldCounterProps } from './Field.Counter.js';

export type FieldRowProps = {
  children?: ReactNode;
  className?: string;
} & ComponentPropsWithRef<'div'>;

function Row({ className, ...props }: FieldRowProps) {
  return <div {...props} className={cx(styles.row, className)} />;
}

export type FieldGroupProps = {
  children?: ReactNode;
  className?: string;
} & ComponentPropsWithRef<'div'>;

/**
 * Puts a label or caption field.label.gap above the control; Description and
 * ErrorMessage keep the distances they have outside a group. Inside a
 * Form.Root it is a validation scope: its controls' native problems show in an
 * `ErrorMessage.Root` with no `id`.
 */
function Group({ className, ref, onChangeCapture, onFocus, onBlur, ...props }: FieldGroupProps) {
  const outer = useContext(FieldsetContext);
  const groupRef = useRef<HTMLDivElement>(null);
  const refs = useComposedRefs(groupRef, ref);
  const scope = useValidationScope(groupRef, { onChangeCapture, onFocus, onBlur });
  const { extend } = scope;
  const ctx = useMemo(() => extend(outer), [extend, outer]);
  return (
    <ValidationScopeContext.Provider value={scope.value}>
      <FieldsetContext.Provider value={ctx}>
        <div {...props} {...scope.props} ref={refs} className={cx(styles.group, className)} />
      </FieldsetContext.Provider>
    </ValidationScopeContext.Provider>
  );
}

export const Field = {
  Root,
  TextInput,
  NumberInput,
  OneTimeCode,
  Textarea,
  ChipInput,
  Select,
  DateInput,
  TimeInput,
  DateTimeInput,
  DateRangeInput,
  Picker,
  Icon,
  Affix,
  Increment,
  Decrement,
  Counter,
  Row,
  Group,
} as const;
