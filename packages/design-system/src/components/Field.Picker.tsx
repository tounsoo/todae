import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useFieldContext } from './Field.context.js';
import {
  hasControl,
  readPicks,
  readServerPicks,
  serverNo,
  useRegistryValue,
  type FieldPicks,
} from './fieldRegistry.js';
import { useFieldControl, type FieldControlUserProps } from './useField.js';
import { cx } from '../internal/props.js';
import styles from './Field.module.css';
import { useControlledState } from '../hooks/useControlledState.js';
import { usePopover, type PopoverCloseReason, type PopoverTriggerUserProps } from '../hooks/usePopover.js';
import { Popover } from './Popover.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings, type Strings } from '../providers/StringsProvider.js';
import { CalendarGlyph, ChevronGlyph, ClockGlyph, glyphOr } from './glyphs.js';
import { PICKER_FOCUS, PickContext } from './pickerDone.js';
import { removeAnchorName } from '../overlay/anchorName.js';

/** Why Field.Picker's popover closed: a popover's reasons, a pick that made the value, or the field became disabled. */
export type FieldPickerCloseReason = PopoverCloseReason | 'select' | 'disabled';

/** What Field.Picker's children get when they are a function. */
export type FieldPickerControls = {
  /** Closes the popover, as a pick in a Calendar or OptionList does. */
  close: () => void;
};

export type FieldPickerProps = {
  /**
   * The button's name beside another control, and the popover's name. By
   * default it comes from the typed input beside it: the datePicker,
   * timePicker, dateTimePicker or dateRangePicker string, or else, with
   * `swatch`, the colorPicker string, and without it the picker string.
   */
  label?: string;
  /** What the button shows. By default a calendar beside a date input, a clock beside a time input, or else a chevron. */
  glyph?: ReactNode;
  /** A CSS color, such as a ColorPicker's value, that makes the button a swatch filled with it, one line of field text tall, in place of a glyph. */
  swatch?: string;
  /** Controlled open state of the popover. Pass with onOpenChange. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Fires when the popover opens or closes, with why it closed. */
  onOpenChange?: (open: boolean, reason: FieldPickerCloseReason) => void;
  /**
   * Whether a pick in a Calendar or OptionList inside closes the popover.
   * Default true. Set false for a panel that takes more than one pick, such
   * as a Calendar beside an OptionList of times, and call `close` once the
   * value is whole.
   */
  closeOnPick?: boolean;
  /**
   * What the popover holds, such as a Calendar.Root, an OptionList.Root or a
   * ColorPicker.Root, mounted only while it is open. A pick in a Calendar or
   * OptionList closes it, unless `closeOnPick` is false. A function gets
   * `close` for a panel of your own.
   */
  children?: ReactNode | ((controls: FieldPickerControls) => ReactNode);
} & Omit<ComponentPropsWithRef<'button'>, 'value' | 'defaultValue' | 'children' | 'type' | 'onChange' | 'color'>;

function labelFor(picks: FieldPicks | null, swatch: boolean, strings: Strings): string {
  switch (picks) {
    case 'date':
      return strings.datePicker;
    case 'time':
      return strings.timePicker;
    case 'dateTime':
      return strings.dateTimePicker;
    case 'dateRange':
      return strings.dateRangePicker;
    default:
      return swatch ? strings.colorPicker : strings.picker;
  }
}

/**
 * A button in the field that opens a popover around a panel, such as a
 * Calendar, an OptionList or a ColorPicker, and closes it once a pick in the
 * panel makes the value. The panel's value is yours to pass: give it the same
 * value as the typed input beside it, such as a Field.DateInput, which shows
 * and sends it. Beside that input, the input is the field's control and the
 * button is named `label`; alone, the button is the field's control. Alone,
 * a press elsewhere in the field opens it; beside a typed input, such a press
 * focuses the input, and a press on a read-only typed input opens it.
 */
export function Picker({
  label: labelProp,
  glyph: glyphProp,
  swatch,
  open: openProp,
  defaultOpen,
  onOpenChange,
  closeOnPick = true,
  children,
  className,
  style,
  ...props
}: FieldPickerProps) {
  const strings = useStrings();
  const glyphs = useGlyphs();
  // A press on the shell beside the button toggles it, through the field's registry.
  const toggleRef = useRef(() => {});
  const toggle = useCallback(() => toggleRef.current(), []);
  // A picker, not a control: it leaves the field to any control beside it.
  const field = useFieldControl({ role: 'picker', toggle });
  const { shellRef, registry } = useFieldContext();
  const beside = useRegistryValue(registry, hasControl, serverNo);
  const picks = useRegistryValue(registry, readPicks, readServerPicks);
  const label = labelProp ?? labelFor(picks, swatch !== undefined, strings);
  const glyph =
    glyphProp ??
    (picks === 'time'
      ? glyphOr(glyphs.clock, <ClockGlyph />)
      : picks
        ? glyphOr(glyphs.calendar, <CalendarGlyph />)
        : glyphOr(glyphs.chevron, <ChevronGlyph />));
  // The button never sends: the typed input beside it does.
  const wired = field.getControlProps(props as typeof props & FieldControlUserProps, { sendsName: false });
  // Beside another control, that control takes the field's id and description, and the button keeps the ref that tracks it, `disabled` and `aria-invalid`, and is named `label`.
  const control = beside
    ? {
        ...props,
        ref: wired.ref,
        disabled: wired.disabled,
        'aria-invalid': wired['aria-invalid'],
        'aria-label': props['aria-label'] ?? label,
        'data-todae-field-control': wired['data-todae-field-control'],
      }
    : wired;
  const [open, setOpen] = useControlledState<boolean, [FieldPickerCloseReason]>(
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
  const popoverNode = useRef<{ current: HTMLElement | null } | null>(null);
  // The panel's own place to start, such as a Calendar's Tab stop, else the popover's first tabbable.
  const initialFocusRef = useMemo(
    () => ({
      get current() {
        return popoverNode.current?.current?.querySelector<HTMLElement>(PICKER_FOCUS) ?? null;
      },
    }),
    [],
  );
  const popover = usePopover({
    open: shown,
    // A read-only open has no one to ask, so the popover asks no one either.
    onOpenChange: openProp === undefined || onOpenChange ? setOpen : undefined,
    // Where it sits, and for the outside-press check: a press anywhere in the field is not outside.
    anchorRef: shellRef,
    initialFocusRef,
    enabled: !control.disabled,
    haspopup: 'dialog',
  });
  popoverNode.current = popover.popoverRef;
  toggleRef.current = () => {
    if (!control.disabled) setOpen(!shown, 'trigger');
  };
  const wiredTrigger = popover.getTriggerProps({ ...control, style } as PopoverTriggerUserProps) as ComponentPropsWithRef<'button'>;
  // The popover sits at the field's shell, as a Field.Select's list sits at its field, so it opens under the
  // whole field and not past the button at its end, where a narrow screen has no room for it. The shell carries
  // the popover's anchor name, so the button keeps only any name of its own, such as a tooltip's.
  const popoverAnchor = (wiredTrigger.style as Record<string, string> | undefined)?.['--todae-popover-anchor'] ?? '';
  const trigger = {
    ...wiredTrigger,
    style: { ...wiredTrigger.style, anchorName: removeAnchorName(wiredTrigger.style?.anchorName, popoverAnchor) || undefined },
  };
  // A pick in a panel tells the field a person changed its value, and one that makes the value closes the popover.
  const picked = useCallback(
    (complete: boolean) => {
      field.notifyValueChange();
      // A typed input beside it drops what was typed and tells the field under its own name too.
      registry.picked();
      if (complete && closeOnPick) close.current(false, 'select');
    },
    [closeOnPick, field, registry],
  );
  return (
    <>
      {swatch === undefined ? (
        <button
          {...trigger}
          // The popover exists only while open, so only then does the button control it.
          aria-controls={shown ? trigger['aria-controls'] : undefined}
          type="button"
          className={cx(styles.picker, className)}
        >
          <span className={styles.pickerGlyph} data-todae-glyph="" aria-hidden="true">
            {glyph}
          </span>
        </button>
      ) : (
        <button
          {...trigger}
          aria-controls={shown ? trigger['aria-controls'] : undefined}
          type="button"
          className={cx(styles.swatch, className)}
          style={{ ...trigger.style, '--_swatch': swatch } as CSSProperties}
        />
      )}
      {/* Mounted while open only: a form can hold many pickers, and closing drops what a pick left pending. */}
      {shown ? (
        <Popover.Root
          {...popover.getPopoverProps()}
          role="dialog"
          aria-label={label}
          className={styles.pickerPopover}
        >
          <PickContext.Provider value={picked}>
            {typeof children === 'function' ? children({ close: () => close.current(false, 'select') }) : children}
          </PickContext.Provider>
        </Popover.Root>
      ) : null}
    </>
  );
}
