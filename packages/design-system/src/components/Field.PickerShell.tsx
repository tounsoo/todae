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
type PickerCloseReason = PopoverCloseReason | 'select' | 'disabled';

/** What a picker's popover content uses to report a pick. */
export type PickerShellControls = {
  /** Tells the field that a person changed the value. */
  notifyValueChange: () => void;
  /** Closes the popover after a pick. */
  close: () => void;
};

export type PickerShellProps = {
  /** The button's name beside another control, from StringsProvider. */
  label: string;
  /** The glyph after the value's text. */
  glyph: ReactNode;
  /** The value as the button shows it, or the placeholder. */
  text: ReactNode;
  /** Whether there is no value, so `text` is the placeholder. */
  empty: boolean;
  showValue?: boolean;
  required?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: PickerCloseReason) => void;
  /** What takes focus when the popover opens. */
  focusSelector: string;
  haspopup?: PopoverHaspopup;
  /** The value input's type, value and bounds. */
  valueInput: Omit<ValueInputOptions, 'name' | 'required'>;
  /** The popover's role, name and class. */
  popoverProps?: PopoverChrome;
  /** The popover's content. */
  children: (controls: PickerShellControls) => ReactNode;
} & Omit<ComponentPropsWithRef<'button'>, 'value' | 'defaultValue' | 'children' | 'type' | 'onChange' | 'placeholder'>;

/**
 * The button, value input and popover that Field.DatePicker,
 * Field.DateRangePicker, Field.TimePicker and Field.DateTimePicker render
 * around useFieldPicker: the value's text, or the placeholder, beside a glyph,
 * with `showValue={false}` the glyph only.
 */
export function PickerShell({
  label,
  glyph,
  text,
  empty,
  showValue = true,
  required,
  open,
  defaultOpen,
  onOpenChange,
  focusSelector,
  haspopup,
  valueInput,
  popoverProps,
  children,
  className,
  style,
  'aria-describedby': describedBy,
  ...props
}: PickerShellProps) {
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
          <span id={textId} className={styles.pickerText} data-placeholder={empty ? '' : undefined}>
            {text}
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
            notifyValueChange: picker.notifyValueChange,
            close: () => picker.setOpen(false, 'select'),
          })}
        </Popover.Root>
      ) : null}
    </>
  );
}
