/// <reference lib="esnext.temporal" preserve="true" />
import {
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useDomId } from './domId.js';
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
import { isValidityCarrier, valueInputOf } from './validity.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import styles from './Field.module.css';
import { createCountStore, pickerToggles } from './Field.shared.js';
import { TextInput } from './Field.TextInput.js';
import { NumberInput } from './Field.NumberInput.js';
import { OneTimeCode } from './Field.OneTimeCode.js';
import { Decrement, Increment } from './Field.StepButton.js';
import { Textarea } from './Field.Textarea.js';
import { ChipInput } from './Field.ChipInput.js';
import { Select } from './Field.Select.js';
import { ColorPicker } from './Field.ColorPicker.js';
import { DatePicker } from './Field.DatePicker.js';
import { TimePicker } from './Field.TimePicker.js';
import { DateTimePicker } from './Field.DateTimePicker.js';
import { DateRangePicker } from './Field.DateRangePicker.js';
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

type PickerControl = HTMLSelectElement | HTMLButtonElement;

// A control whose picker a press beside it opens: a select or a picker that useFieldPicker drives.
function hasPicker(control: Element | null | undefined): control is PickerControl {
  return (
    control instanceof HTMLSelectElement ||
    (control instanceof HTMLButtonElement && control.hasAttribute('data-todae-field-picker'))
  );
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

// A press in a part's own popover, such as Field.ColorPicker's, is not a press on the shell.
function inOwnPopover(target: EventTarget | null, shell: HTMLElement): boolean {
  const popover = target instanceof Element ? target.closest('[popover]') : null;
  return popover != null && shell.contains(popover);
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
  const inputRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const shellComposed = useComposedRefs(shellRef, props.ref);
  const pendingPicker = useRef<PickerControl | null>(null);
  const [store] = useState(createCountStore);
  const inputId = id ?? autoId;
  // The control the shell focuses is the field's one native control, when it has one, else the first input that carries the field's value.
  useCustomValidity(shellRef, () => {
    const control = inputRef.current;
    return control && isValidityCarrier(control) ? control : shellRef.current && valueInputOf(store, shellRef.current);
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
      inputRef,
      shellRef,
      store,
    }),
    [ariaLabel, describedByWithError, disabled, hintId, inputId, invalid, labelledBy, name, store],
  );

  function onMouseDown(event: MouseEvent<HTMLDivElement>) {
    // Only a primary press: a right or middle click keeps its own meaning.
    if (event.button !== 0 || disabled || isInteractiveTarget(event.target)) return;
    if (inOwnPopover(event.target, event.currentTarget)) return;
    event.preventDefault();
    // The ref is the last control to mount. If that one has gone, a control
    // still in the shell takes the press, never one inside an Icon or Affix.
    const current = inputRef.current;
    const usable = (node: HTMLElement) =>
      node.matches(FOCUSABLE_FIELD_CONTROL_SELECTOR) && !inAdornment(node, event.currentTarget);
    const control = current?.isConnected && usable(current)
      ? current
      : [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_FIELD_CONTROL_SELECTOR)].find(usable);
    control?.focus();
    // A press beside a select, color, date or time picker acts as a press on the control
    // would. The picker opens on click: one opened now would close again as
    // the press goes on. A select's open picker closes on this press, which
    // must not open it again; Field.ColorPicker's toggles on the click.
    pendingPicker.current =
      hasPicker(control) && (control instanceof HTMLButtonElement || !isOpen(control)) ? control : null;
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const picker = pendingPicker.current;
    pendingPicker.current = null;
    // Only the click that ends this press: one from the keyboard or from
    // assistive technology has no press (detail 0) and opens nothing.
    if (!picker?.isConnected || event.detail === 0 || isInteractiveTarget(event.target)) return;
    if (picker instanceof HTMLButtonElement) {
      pickerToggles.get(picker)?.();
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
export type { FieldColorPickerCloseReason, FieldColorPickerProps } from './Field.ColorPicker.js';
export type { FieldDatePickerCloseReason, FieldDatePickerProps } from './Field.DatePicker.js';
export type { FieldTimePickerCloseReason, FieldTimePickerProps } from './Field.TimePicker.js';
export type { FieldDateTimePickerCloseReason, FieldDateTimePickerProps } from './Field.DateTimePicker.js';
export type { FieldDateRangePickerCloseReason, FieldDateRangePickerProps } from './Field.DateRangePicker.js';
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
  ColorPicker,
  DatePicker,
  TimePicker,
  DateTimePicker,
  DateRangePicker,
  Icon,
  Affix,
  Increment,
  Decrement,
  Counter,
  Row,
  Group,
} as const;
