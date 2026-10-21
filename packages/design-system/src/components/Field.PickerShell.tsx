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

/** What the pickers share: the popover's open state, the button's text and the native button attributes. */
export type PickerBaseProps = {
  /** A form with no value is invalid. */
  required?: boolean;
  /** The locale for the button's text and the picker's names, such as "ko". The browser's own when not set, so pass it when the picker renders on a server. */
  locale?: string;
  /** Shown on the button while there is no value, when showValue is true. */
  placeholder?: string;
  /**
   * Whether the button shows the value, or the placeholder, beside its glyph. Set it to false beside a text input that shows the value.
   * @default true
   */
  showValue?: boolean;
  /** Controlled open state of the popover. Pass with onOpenChange. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Fires when the popover opens or closes, with why it closed. */
  onOpenChange?: (open: boolean, reason: PickerCloseReason) => void;
} & Omit<ComponentPropsWithRef<'button'>, 'value' | 'defaultValue' | 'children' | 'type' | 'onChange' | 'placeholder'>;

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

export type PickerShellProps<Value> = Omit<PickerBaseProps, 'locale'> & {
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
  haspopup?: PopoverHaspopup;
  /** The value input's type, value and bounds. */
  valueInput: Omit<ValueInputOptions, 'name' | 'required'>;
  /** The popover's role, name and class. A dialog named `label` unless set. */
  popoverProps?: PopoverChrome;
  /** The popover's content. */
  children: (controls: PickerShellControls<Value>) => ReactNode;
};

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
  haspopup,
  valueInput,
  popoverProps = { role: 'dialog', 'aria-label': label, className: styles.datePickerPopover },
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
    haspopup,
  });
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
        <Popover.Root {...picker.popover.getPopoverProps()} {...popoverProps}>
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
