import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useDomId } from './domId.js';
import { mergeDescribedBy } from './Field.context.js';
import { cx } from './props.js';
import styles from './Field.module.css';
import type { PopoverCloseReason, PopoverHaspopup } from '../hooks/usePopover.js';
import { Popover, type PopoverChrome } from './Popover.js';
import { useFieldPicker } from './Field.shared.js';
import { FieldValueInput } from './Field.ValueInput.js';
import type { ValueInputOptions } from './valueInput.js';

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
 * The button, value input and popover that Field.DatePicker,
 * Field.DateRangePicker, Field.TimePicker and Field.DateTimePicker render
 * around useFieldPicker: the value's text, or the placeholder, beside a glyph,
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
        data-todae-field-picker=""
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
