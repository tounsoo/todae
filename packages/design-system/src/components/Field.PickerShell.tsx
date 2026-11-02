import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { useDomId } from '../internal/domId.js';
import { mergeDescribedBy, useFieldContext } from './Field.context.js';
import { hasControl, useRegistryValue } from './fieldRegistry.js';
import { useFieldControl, type FieldControlUserProps, type UseFieldResult } from './useField.js';
import { cx } from '../internal/props.js';
import styles from './Field.module.css';
import { useControlledState } from '../hooks/useControlledState.js';
import {
  usePopover,
  type PopoverCloseReason,
  type PopoverHaspopup,
  type PopoverTriggerUserProps,
} from '../hooks/usePopover.js';
import { Popover, type PopoverChrome } from './Popover.js';
import { FieldValueInput } from './Field.ValueInput.js';
import type { ControlBrand, ValueInputOptions } from './valueInput.js';

type PickerOwnProps = {
  name?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: FieldControlUserProps['aria-invalid'];
};

/**
 * A picker's control props. Alone, it is the field's control. Beside another
 * control, that control takes the field's id and description, and the button
 * keeps the ref that tracks it, `disabled` and `aria-invalid`, and is named
 * `label`. Either way the button has no name: the picker's value input takes it.
 */
function pickerControl<P extends PickerOwnProps>(
  beside: boolean,
  field: UseFieldResult,
  props: P,
  label: string,
) {
  // The button never sends: its value input takes the name.
  const control = field.getControlProps(props, { sendsName: false });
  if (!beside) return control;
  const { name: _own, ...own } = props;
  return {
    ...own,
    ref: control.ref,
    disabled: control.disabled,
    'aria-invalid': control['aria-invalid'],
    'aria-label': props['aria-label'] ?? label,
  } as typeof own & Pick<typeof control, 'ref' | 'disabled' | 'aria-invalid'> & ControlBrand;
}

/**
 * What the Field pickers share: Field.ColorPicker, Field.DatePicker,
 * Field.DateRangePicker, Field.TimePicker and Field.DateTimePicker. It gives
 * the button's control props, the open state, which closes when the field is
 * disabled, and the popover, which focuses the element `focusSelector` finds
 * when it opens, or without one its first tabbable.
 */
export function useFieldPicker<Reason extends string>({
  props,
  label,
  open: openProp,
  defaultOpen,
  onOpenChange,
  style,
  focusSelector,
  haspopup,
  required,
}: {
  props: PickerOwnProps & Record<string, unknown>;
  label: string;
  /** The picker is required: its value input says so, and the button is described as required. */
  required?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: Reason | PopoverCloseReason | 'disabled') => void;
  style?: CSSProperties;
  focusSelector?: string;
  /** What the popover holds, for the button's aria-haspopup: a dialog by default. */
  haspopup?: PopoverHaspopup;
}) {
  // A press on the shell beside the button toggles it, through the field's registry.
  const toggleRef = useRef(() => {});
  const toggle = useCallback(() => toggleRef.current(), []);
  // A picker, not a control: it leaves the field to any control beside it.
  const field = useFieldControl({ role: 'picker', toggle });
  const { shellRef, registry } = useFieldContext();
  const beside = useRegistryValue(registry, hasControl);
  // A button cannot say `aria-required`, so a required picker is described as required.
  const requiredId = useDomId();
  const describedBy = mergeDescribedBy(props['aria-describedby'], required ? requiredId : undefined);
  // Another control in the field takes its id and description.
  const control = pickerControl(beside, field, { ...props, 'aria-describedby': describedBy }, label);
  const [open, setOpen] = useControlledState<boolean, [Reason | PopoverCloseReason | 'disabled']>(
    openProp,
    defaultOpen ?? false,
    onOpenChange,
  );
  // A disabled field shows no popover, and one open when the field is
  // disabled closes, so it does not come back when the field is enabled again.
  const shown = open && !control.disabled;
  const close = useRef(setOpen);
  close.current = setOpen;
  useEffect(() => {
    if (open && control.disabled) close.current(false, 'disabled');
  }, [control.disabled, open]);
  const popoverRef = useRef<RefObject<HTMLElement | null> | null>(null);
  const initialFocusRef = useMemo(
    () =>
      focusSelector === undefined
        ? undefined
        : {
            get current() {
              return popoverRef.current?.current?.querySelector<HTMLElement>(focusSelector) ?? null;
            },
          },
    [focusSelector],
  );
  const popover = usePopover({
    open: shown,
    // A read-only open has no one to ask, so the popover asks no one either.
    onOpenChange: openProp === undefined || onOpenChange ? setOpen : undefined,
    // For the outside-press check: a press anywhere in the field is not outside.
    anchorRef: shellRef,
    initialFocusRef,
    enabled: !control.disabled,
    haspopup,
  });
  popoverRef.current = popover.popoverRef;
  const trigger = popover.getTriggerProps({ ...control, style } as PopoverTriggerUserProps);
  toggleRef.current = () => {
    if (!control.disabled) setOpen(!shown, 'trigger');
  };
  // A button sends nothing and the browser can't validate it, so the value goes in a value input, which follows the button; and a required picker says so.
  const valueInput = (options: Omit<ValueInputOptions, 'name' | 'required'>) => ({
    input: field.getValueInputProps({ name: props.name, required, ...options }, control),
    requiredId: required ? requiredId : undefined,
  });
  return {
    valueInput,
    notifyValueChange: field.notifyValueChange,
    shown,
    setOpen,
    popover,
    // The popover exists only while open, so only then does the button control it.
    triggerProps: { ...(trigger as ComponentPropsWithRef<'button'>), 'aria-controls': shown ? trigger['aria-controls'] : undefined },
  };
}


/** Why a picker's popover closed: a popover's reasons, a pick, or the field became disabled. */
export type PickerCloseReason = PopoverCloseReason | 'select' | 'disabled';

/** The native button attributes a picker takes. */
export type PickerButtonProps = Omit<
  ComponentPropsWithRef<'button'>,
  'value' | 'defaultValue' | 'children' | 'type' | 'onChange' | 'placeholder'
>;

/** What a picker's popover content uses to report a pick. */
export type PickerShellControls<Value> = {
  /**
   * Tells the field that a person changed the value, fires `onValueChange` with it and, unless
   * `close` is false, closes the popover.
   */
  pick: (next: Value, options?: { close?: boolean }) => void;
  /** Closes the popover. */
  close: () => void;
};

export type PickerShellProps<Value> = {
  required?: boolean;
  /** Shown on the button while `shown` is null, when showValue is true. */
  placeholder?: string;
  /** Whether the button shows its value, or the placeholder, beside its glyph. */
  showValue?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: PickerCloseReason) => void;
  /** The button's name beside another control, from StringsProvider. */
  label: string;
  /** The glyph after the value's text. */
  glyph: ReactNode;
  /** The value as the button shows it, or null for none, which shows the placeholder. */
  shown: ReactNode | null;
  /** Fires with a value picked in the popover. */
  onValueChange?: (value: Value) => void;
  /** What takes focus when the popover opens. */
  focusSelector: string;
  /** What the popover holds: a dialog named `label`, the default, or a named list that needs no role around it. */
  popup?: Extract<PopoverHaspopup, 'dialog' | 'listbox'>;
  /** The value input's type, value and bounds. */
  valueInput: Omit<ValueInputOptions, 'name' | 'required'>;
  /** The popover's content. */
  children: (controls: PickerShellControls<Value>) => ReactNode;
} & PickerButtonProps;

/**
 * The button, value input and popover that every picker but Field.ColorPicker
 * renders around useFieldPicker: the value's text, or the placeholder, beside a glyph,
 * with `showValue={false}` the glyph only.
 */
export function PickerShell<Value>({
  label,
  glyph,
  shown,
  placeholder,
  onValueChange,
  showValue = true,
  required,
  open,
  defaultOpen,
  onOpenChange,
  focusSelector,
  popup = 'dialog',
  valueInput,
  children,
  className,
  style,
  'aria-describedby': describedBy,
  ...props
}: PickerShellProps<Value>) {
  const textId = useDomId();
  // The button's name is not the value, so the value it shows is its description.
  const picker = useFieldPicker<'select'>({
    props: { ...props, 'aria-describedby': showValue ? mergeDescribedBy(describedBy, textId) : describedBy },
    label,
    open,
    defaultOpen,
    onOpenChange,
    style,
    required,
    focusSelector,
    haspopup: popup,
  });
  const chrome: PopoverChrome =
    popup === 'dialog' ? { role: 'dialog', 'aria-label': label, className: styles.datePickerPopover } : {};
  return (
    <>
      <button
        {...picker.triggerProps}
        type="button"
        data-glyph-only={showValue ? undefined : ''}
        className={cx(styles.picker, className)}
      >
        {showValue ? (
          <span id={textId} className={styles.pickerText} data-placeholder={shown === null ? '' : undefined}>
            {shown ?? placeholder}
          </span>
        ) : null}
        <span className={styles.pickerGlyph} data-todae-glyph="" aria-hidden="true">
          {glyph}
        </span>
      </button>
      <FieldValueInput {...picker.valueInput(valueInput)} />
      {/* Mounted while open only: a form can hold many pickers, and closing drops what a pick left pending. */}
      {picker.shown ? (
        <Popover.Root {...picker.popover.getPopoverProps()} {...chrome}>
          {children({
            pick: (next, { close = true } = {}) => {
              picker.notifyValueChange();
              onValueChange?.(next);
              if (close) picker.setOpen(false, 'select');
            },
            close: () => picker.setOpen(false, 'select'),
          })}
        </Popover.Root>
      ) : null}
    </>
  );
}
