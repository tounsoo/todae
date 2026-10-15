/// <reference lib="esnext.temporal" preserve="true" />
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useFieldContext, type CountStore } from './Field.context.js';
import { useFieldControl, type FieldControlUserProps, type UseFieldResult } from '../hooks/useField.js';
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

const BESIDE_CONTROL = 1;
const BESIDE_NAMED = 2;

/**
 * Which controls a picker shares its field with, as bits: BESIDE_CONTROL for
 * any control wired with useField, BESIDE_NAMED when useField gave one the
 * field's name. The server cannot know of one yet, so it reads 0 until
 * hydration.
 */
function usePickerPresence(store: CountStore) {
  const subscribe = useCallback((listener: () => void) => subscribePresence(store, listener), [store]);
  return useSyncExternalStore(
    subscribe,
    () => (store.controls > 0 ? BESIDE_CONTROL : 0) | (store.named > 0 ? BESIDE_NAMED : 0),
    () => 0,
  );
}

/**
 * A picker's control props. Alone, it is the field's control. Beside another
 * control, that control takes the field's id and description, and the field's
 * name too when useField gave it that name. The picker keeps its own
 * `name`, else the field's name when no other control has it, and `disabled`
 * and `aria-invalid`, and is named `label`.
 */
function pickerControl<P extends PickerOwnProps>(
  presence: number,
  field: UseFieldResult,
  props: P,
  label: string,
) {
  if (!(presence & BESIDE_CONTROL)) return field.getControlProps(props);
  return {
    ...props,
    name: props.name ?? (presence & BESIDE_NAMED ? undefined : field.name),
    disabled: field.disabled || Boolean(props.disabled),
    'aria-invalid': field.invalid ? true : props['aria-invalid'],
    'aria-label': props['aria-label'] ?? label,
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
export const pickerToggles = new WeakMap<HTMLButtonElement, () => void>();

// A time for a hidden input stops at the smallest unit that is set.
function timeUnit(value: Temporal.PlainTime | Temporal.PlainDateTime) {
  if (value.millisecond || value.microsecond || value.nanosecond) return 'millisecond';
  return value.second ? 'second' : 'minute';
}

// HTML writes a year past 9999 as plain digits (20261-10-07); Temporal writes it
// with a sign and six digits (+020261-10-07).
function toHtmlYear(text: string) {
  return text.replace(/^\+0*(\d{4,})(?=-)/, '$1');
}

/** A date as HTML writes one, such as 2026-10-07, for Field.DatePicker's hidden input. */
export const htmlDate = (value: Temporal.PlainDate) => toHtmlYear(value.toString({ calendarName: 'never' }));

/** A date and time as HTML writes one, such as 2026-10-07T09:30, for Field.DateTimePicker's hidden input. */
export const htmlDateTime = (value: Temporal.PlainDateTime) =>
  toHtmlYear(value.withCalendar('iso8601').toString({ smallestUnit: timeUnit(value), calendarName: 'never' }));

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
}: {
  props: PickerOwnProps & Record<string, unknown>;
  label: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: Reason | PopoverCloseReason | 'disabled') => void;
  style?: CSSProperties;
  focusSelector?: string;
  /** What the popover holds, for the button's aria-haspopup: a dialog by default. */
  haspopup?: PopoverHaspopup;
}) {
  // The button does not count itself as a control another picker should leave the field to.
  const field = useFieldControl(false);
  const { shellRef, store } = useFieldContext();
  // Another control in the field takes its id and description.
  const presence = usePickerPresence(store);
  const { name, ...control } = pickerControl(presence, field, props, label);
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
    name,
    disabled: control.disabled,
    form: control.form as string | undefined,
    shown,
    setOpen,
    popover,
    // The popover exists only while open, so only then does the button control it.
    triggerProps: { ...(trigger as ComponentPropsWithRef<'button'>), 'aria-controls': shown ? trigger['aria-controls'] : undefined },
  };
}

/** A time as HTML writes one, such as 09:30 or 09:30:15, for Field.TimePicker's hidden input. */
export const htmlTime = (value: Temporal.PlainTime) => value.toString({ smallestUnit: timeUnit(value) });
