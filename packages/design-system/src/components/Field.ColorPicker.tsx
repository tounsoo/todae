import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { cx } from './props.js';
import styles from './Field.module.css';
import { useStrings } from '../providers/StringsProvider.js';
import type { PopoverCloseReason } from '../hooks/usePopover.js';
import { Popover } from './Popover.js';
import { ColorPicker as ColorPickerParts } from './ColorPicker.js';
import { useFieldPicker } from './Field.shared.js';
import { FieldValueInput } from './Field.ValueInput.js';

/** Why Field.ColorPicker's picker closed: a popover's reasons, or the field became disabled. */
export type FieldColorPickerCloseReason = PopoverCloseReason | 'disabled';

export type FieldColorPickerProps = {
  /** The color as #rrggbb. */
  value: string;
  /** Fires with the new color as #rrggbb while it is dragged or keyed in the picker. */
  onValueChange?: (value: string) => void;
  /** Controlled open state of the picker. Pass with onOpenChange. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Fires when the picker opens or closes, with why it closed. */
  onOpenChange?: (open: boolean, reason: FieldColorPickerCloseReason) => void;
} & Omit<ComponentPropsWithRef<'button'>, 'value' | 'defaultValue' | 'children' | 'type' | 'color' | 'onChange'>;

/**
 * The field's control: a button the height of a line of field text, filled
 * with the color. It opens a ColorPicker in a popover, as does a press
 * elsewhere in the field. Beside any other control in the field but a
 * Field.ColorPicker, Field.DatePicker, Field.DateRangePicker, Field.TimePicker
 * or Field.DateTimePicker, such as a Field.TextInput, that control is the
 * field's control instead, and the button is named from the colorPicker
 * string. The color goes in a native text input under the field's name unless
 * another control took it.
 */
export function ColorPicker({
  value,
  onValueChange,
  open,
  defaultOpen,
  onOpenChange,
  className,
  style,
  ...props
}: FieldColorPickerProps) {
  const strings = useStrings();
  // No focusSelector: the popover focuses its first tabbable, the color area.
  const picker = useFieldPicker<never>({
    props,
    label: strings.colorPicker,
    open,
    defaultOpen,
    onOpenChange,
    style,
  });
  return (
    <>
      <button
        {...picker.triggerProps}
        type="button"
        data-todae-field-picker=""
        className={cx(styles.swatch, className)}
        style={{ ...picker.triggerProps.style, '--_swatch': value } as CSSProperties}
      />
      {/* A button sends nothing, so the color goes in a value input. Text, not color: that type would lowercase the value and turn one that is not #rrggbb into black. */}
      <FieldValueInput {...picker.valueInput({ type: 'text', value })} />
      {/* Mounted while open only: a form can hold many swatches. */}
      {picker.shown ? (
        <Popover.Root {...picker.popover.getPopoverProps()} role="dialog" aria-label={strings.colorPicker}>
          <ColorPickerParts.Root
            value={value}
            onValueChange={(next) => {
              picker.notifyValueChange();
              onValueChange?.(next);
            }}
          >
            <ColorPickerParts.Area />
            <ColorPickerParts.Hue />
          </ColorPickerParts.Root>
        </Popover.Root>
      ) : null}
    </>
  );
}
