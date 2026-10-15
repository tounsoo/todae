import { useEffect, useLayoutEffect, useRef, type ComponentPropsWithRef, type CSSProperties } from 'react';
import { useFieldContext } from './Field.context';
import { cx } from './props';
import styles from './Field.module.css';
import { useFieldControl } from '../hooks/useField';
import { useControlledValue } from '../hooks/useControlledState';
import { useStrings } from '../providers/StringsProvider';
import { usePopover, type PopoverCloseReason, type PopoverTriggerUserProps } from '../hooks/usePopover';
import { Popover } from './Popover';
import { ColorPicker as ColorPickerParts } from './ColorPicker';
import { usePickerPresence, pickerControl, pickerToggles } from './Field.shared';

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
 * Field.ColorPicker, Field.DatePicker, Field.TimePicker or Field.DateTimePicker, such as a Field.TextInput, that
 * control is the field's control instead, and the button is named from the colorPicker string.
 */
export function ColorPicker({
  value,
  onValueChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  className,
  style,
  ...props
}: FieldColorPickerProps) {
  // The swatch does not count itself as a control another picker should leave the field to.
  const field = useFieldControl(false);
  const { shellRef, store } = useFieldContext();
  const strings = useStrings();
  // Another control in the field takes its id and description, and one that
  // useField gave the field's name, that name.
  const presence = usePickerPresence(store);
  const { name, ...control } = pickerControl(presence, field, props, strings.colorPicker);
  const [open, setOpen] = useControlledValue<boolean, [FieldColorPickerCloseReason]>(
    openProp,
    defaultOpen ?? false,
    onOpenChange,
  );
  // A disabled field shows no picker. One open when the field is disabled
  // closes, so it does not come back when the field is enabled again.
  const shown = open && !control.disabled;
  // The latest setter, so a new onOpenChange each render does not fire it again.
  const close = useRef(setOpen);
  close.current = setOpen;
  useEffect(() => {
    if (open && control.disabled) close.current(false, 'disabled');
  }, [control.disabled, open]);
  const popover = usePopover({
    open: shown,
    onOpenChange: setOpen,
    // For the outside-press check: a press anywhere in the field is not outside.
    anchorRef: shellRef,
    enabled: !control.disabled,
  });
  const trigger = popover.getTriggerProps({ ...control, style } as PopoverTriggerUserProps);
  const toggle = useRef(() => {});
  toggle.current = () => {
    if (!control.disabled) setOpen(!shown, 'trigger');
  };
  useLayoutEffect(() => {
    const button = popover.triggerRef.current;
    if (!(button instanceof HTMLButtonElement)) return;
    pickerToggles.set(button, () => toggle.current());
    return () => {
      pickerToggles.delete(button);
    };
  }, [popover.triggerRef]);
  // The popover exists only while open, so only then does the button control it.
  const controls = shown ? trigger['aria-controls'] : undefined;
  return (
    <>
      <button
        {...(trigger as ComponentPropsWithRef<'button'>)}
        aria-controls={controls}
        type="button"
        data-todae-field-picker=""
        className={cx(styles.swatch, className)}
        style={{ ...trigger.style, '--_swatch': value } as CSSProperties}
      />
      {/* A button sends nothing with a form, so the value goes in a hidden input. */}
      {name ? <input type="hidden" name={name} value={value} disabled={control.disabled} form={control.form} /> : null}
      {/* Mounted while open only: a form can hold many swatches. */}
      {shown ? (
        <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label={strings.colorPicker}>
          <ColorPickerParts.Root value={value} onValueChange={onValueChange}>
            <ColorPickerParts.Area />
            <ColorPickerParts.Hue />
          </ColorPickerParts.Root>
        </Popover.Root>
      ) : null}
    </>
  );
}
