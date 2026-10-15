/// <reference lib="esnext.temporal" preserve="true" />
import {
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useDomId } from './domId';
import { FIELD_CONTROL_SELECTOR, FOCUSABLE_FIELD_CONTROL_SELECTOR, FieldContext } from './Field.context';
import { useFieldsetState } from './Fieldset.context';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './Field.module.css';
import { createCountStore, pickerToggles } from './Field.shared';
import { TextInput } from './Field.TextInput';
import { Textarea } from './Field.Textarea';
import { ChipInput } from './Field.ChipInput';
import { Select } from './Field.Select';
import { ColorPicker } from './Field.ColorPicker';
import { DatePicker } from './Field.DatePicker';
import { TimePicker } from './Field.TimePicker';
import { DateTimePicker } from './Field.DateTimePicker';
import { Counter } from './Field.Counter';

/**
 * `id`, `name` and the three naming ARIA props go to the input; every other
 * native attribute lands on the shell `div`.
 */
export type FieldRootProps = {
  disabled?: boolean;
  invalid?: boolean;
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

// A control whose picker a press beside it opens: a select, Field.ColorPicker, Field.DatePicker, Field.TimePicker or Field.DateTimePicker.
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
  const { disabled, invalid } = useFieldsetState({ disabled: disabledProp, invalid: invalidProp });
  const autoId = useDomId();
  const hintId = useDomId();
  const inputRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const shellComposed = useComposedRefs(shellRef, props.ref);
  const pendingPicker = useRef<PickerControl | null>(null);
  const [store] = useState(createCountStore);
  const inputId = id ?? autoId;

  // Stable while these inputs are, so parts and useField callbacks keep their identity.
  const ctx = useMemo(
    () => ({
      inputId,
      hintId,
      disabled: Boolean(disabled),
      invalid: Boolean(invalid),
      name,
      describedBy,
      labelledBy,
      ariaLabel,
      inputRef,
      shellRef,
      store,
    }),
    [ariaLabel, describedBy, disabled, hintId, inputId, invalid, labelledBy, name, store],
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

export type { FieldTextInputType, FieldTextInputProps } from './Field.TextInput';
export type { FieldTextareaHighlight } from './TextareaHighlights';
export type { FieldTextareaProps } from './Field.Textarea';
export type { FieldChipInputProps } from './Field.ChipInput';
export type { FieldSelectProps } from './Field.Select';
export type { FieldColorPickerCloseReason, FieldColorPickerProps } from './Field.ColorPicker';
export type { FieldDatePickerCloseReason, FieldDatePickerProps } from './Field.DatePicker';
export type { FieldTimePickerCloseReason, FieldTimePickerProps } from './Field.TimePicker';
export type { FieldDateTimePickerCloseReason, FieldDateTimePickerProps } from './Field.DateTimePicker';
export type { FieldCounterProps } from './Field.Counter';

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

/** Puts a label or caption field.label.gap above the control; Description and ErrorMessage keep the distances they have outside a group. */
function Group({ className, ...props }: FieldGroupProps) {
  return <div {...props} className={cx(styles.group, className)} />;
}

export const Field = {
  Root,
  TextInput,
  Textarea,
  ChipInput,
  Select,
  ColorPicker,
  DatePicker,
  TimePicker,
  DateTimePicker,
  Icon,
  Affix,
  Counter,
  Row,
  Group,
} as const;
