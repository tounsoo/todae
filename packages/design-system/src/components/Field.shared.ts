/// <reference lib="esnext.temporal" preserve="true" />
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type CSSProperties,
  type RefObject,
} from 'react';
import { BESIDE_CONTROL, mergeDescribedBy, useFieldContext, type CountStore } from './Field.context.js';
import { useFieldControl, type FieldControlUserProps, type UseFieldResult } from '../hooks/useField.js';
import { useDomId } from './domId.js';
import { warnOnce } from './warnOnce.js';
import { useControlledValue } from '../hooks/useControlledState.js';
import {
  usePopover,
  type PopoverCloseReason,
  type PopoverHaspopup,
  type PopoverTriggerUserProps,
} from '../hooks/usePopover.js';

export function createCountStore(): CountStore {
  return { entry: null, counters: 0, controls: 0, named: 0, listeners: new Set(), presence: new Set() };
}

function publishCount(store: CountStore, value: string, maxLength: number | undefined) {
  const prev = store.entry;
  if (prev && prev.value === value && prev.maxLength === maxLength) return;
  store.entry = { value, maxLength };
}

export function subscribeCount(store: CountStore, listener: () => void) {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function subscribePresence(store: CountStore, listener: () => void) {
  store.presence.add(listener);
  return () => {
    store.presence.delete(listener);
  };
}

function counterMounted(store: CountStore) {
  return store.counters > 0;
}

type PickerOwnProps = {
  name?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: FieldControlUserProps['aria-invalid'];
};

/**
 * A picker's control props. Alone, it is the field's control. Beside another
 * control, that control takes the field's id and description. Either way the
 * button has no name: the picker's value input takes it. The picker keeps
 * `disabled` and `aria-invalid`, and is named `label`.
 */
function pickerControl<P extends PickerOwnProps>(
  presence: number,
  field: UseFieldResult,
  props: P,
  label: string,
) {
  if (!(presence & BESIDE_CONTROL)) {
    const { name: _name, ...control } = field.getControlProps(props);
    return control;
  }
  const { name: _name, ...own } = props;
  return {
    ...own,
    disabled: field.disabled || Boolean(props.disabled),
    'aria-invalid': field.invalid ? true : props['aria-invalid'],
    'aria-label': props['aria-label'] ?? label,
  };
}

/**
 * One change handler that calls `onChange` and `onValueChange`, or undefined
 * when neither is given, so the control renders read-only.
 */
export function valueChangeHandler<E extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
  onChange: ((event: ChangeEvent<E>) => void) | undefined,
  onValueChange: ((value: string) => void) | undefined,
): ((event: ChangeEvent<E>) => void) | undefined {
  if (!onChange && !onValueChange) return undefined;
  return (event) => {
    onChange?.(event);
    onValueChange?.(event.target.value);
  };
}

export function useTextEntry(store: CountStore, value: string, maxLength: number | undefined) {
  publishCount(store, value, maxLength);
  useEffect(() => {
    for (const listener of store.listeners) listener();
  });
  return useSyncExternalStore(
    (listener) => subscribePresence(store, listener),
    () => counterMounted(store),
    () => counterMounted(store),
  );
}

// How the shell opens or closes each Field.ColorPicker's, Field.DatePicker's, Field.TimePicker's or Field.DateTimePicker's popover, by its button.
export const pickerToggles = /* @__PURE__ */ new WeakMap<HTMLButtonElement, () => void>();

// A time for a value input stops at the smallest unit that is set.
function timeUnit(value: Temporal.PlainTime | Temporal.PlainDateTime) {
  if (value.millisecond || value.microsecond || value.nanosecond) return 'millisecond';
  return value.second ? 'second' : 'minute';
}

// HTML writes a year past 9999 as plain digits (20261-10-07); Temporal writes it
// with a sign and six digits (+020261-10-07).
function toHtmlYear(text: string) {
  return text.replace(/^\+0*(\d{4,})(?=-)/, '$1');
}

// A native date input holds the years 1 to 275760; a value or bound outside them reads as none.
function checkHtmlYear(year: number) {
  if (year < 1 || year > 275760) {
    warnOnce(
      'value-input-year',
      `Field.DatePicker and Field.DateTimePicker carry their value in a native date input, which holds only the years 1 to 275760. The year ${year} reads as no date, so it is submitted as empty and a required, min or max check ignores it.`,
    );
  }
}

/** A date as HTML writes one, such as 2026-10-07, for Field.DatePicker's value input. */
export const htmlDate = (value: Temporal.PlainDate) => {
  checkHtmlYear(value.year);
  return toHtmlYear(value.toString({ calendarName: 'never' }));
};

/** A date and time as HTML writes one, such as 2026-10-07T09:30, for Field.DateTimePicker's value input. */
export const htmlDateTime = (value: Temporal.PlainDateTime) => {
  const iso = value.withCalendar('iso8601');
  checkHtmlYear(iso.year);
  return toHtmlYear(iso.toString({ smallestUnit: timeUnit(value), calendarName: 'never' }));
};

/**
 * What Field.ColorPicker, Field.DatePicker, Field.TimePicker and Field.DateTimePicker share: the
 * button's control props, the open state, which closes when the field is
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
  /** Describes the button as required, with the `required` string in an element the picker renders at `requiredId`. */
  required?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: Reason | PopoverCloseReason | 'disabled') => void;
  style?: CSSProperties;
  focusSelector?: string;
  /** What the popover holds, for the button's aria-haspopup: a dialog by default. */
  haspopup?: PopoverHaspopup;
}) {
  // The button does not count itself as a control another picker should leave the field to.
  const { field, wire, presence } = useFieldControl(false);
  const { shellRef } = useFieldContext();
  // A button cannot say `aria-required`, so a required picker is described as required.
  const requiredId = useDomId();
  const describedBy = mergeDescribedBy(props['aria-describedby'], required ? requiredId : undefined);
  // Another control in the field takes its id and description.
  const control = pickerControl(presence, field, { ...props, 'aria-describedby': describedBy }, label);
  // Alone, getControlProps said what the value input needs; beside another control, this does.
  if (presence & BESIDE_CONTROL) {
    wire({ disabled: Boolean(control.disabled), form: props.form as string | undefined, name: props.name, sends: false });
  }
  const [open, setOpen] = useControlledValue<boolean, [Reason | PopoverCloseReason | 'disabled']>(
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
    onOpenChange: setOpen,
    // For the outside-press check: a press anywhere in the field is not outside.
    anchorRef: shellRef,
    initialFocusRef,
    enabled: !control.disabled,
    haspopup,
  });
  popoverRef.current = popover.popoverRef;
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
  return {
    requiredId,
    getValueInputProps: field.getValueInputProps,
    shown,
    setOpen,
    popover,
    // The popover exists only while open, so only then does the button control it.
    triggerProps: { ...(trigger as ComponentPropsWithRef<'button'>), 'aria-controls': shown ? trigger['aria-controls'] : undefined },
  };
}

/** A time as HTML writes one, such as 09:30 or 09:30:15, for Field.TimePicker's value input. */
export const htmlTime = (value: Temporal.PlainTime) => value.toString({ smallestUnit: timeUnit(value) });
