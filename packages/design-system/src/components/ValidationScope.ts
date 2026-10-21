import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEventHandler,
  type FormEventHandler,
  type RefObject,
} from 'react';
import { useFocusLeave } from '../overlay/useFocusLeave.js';
import { useStrings } from '../providers/StringsProvider.js';
import { useDomId } from './domId.js';
import { FormContext, type Reading, type ValidationScopeValue } from './Form.context.js';
import { pickShown, readScope, sameReadings, SCOPE_ATTRIBUTE, SCOPE_SELECTOR } from './Form.model.js';
import type { FieldsetContextValue } from './Fieldset.context.js';
import type { FormFieldError } from './validity.js';

/** When a scope started to show what its controls say: after a change and the focus leaving, per reset. */
type Reveal = { epoch: number; touched: boolean; revealed: boolean };

const NO_READINGS: readonly Reading[] = [];
const FRESH: Reveal = { epoch: 0, touched: false, revealed: false };

type ScopeHandlers<E extends HTMLElement> = {
  onChangeCapture?: FormEventHandler<E>;
  onFocus?: FocusEventHandler<E>;
  onBlur?: FocusEventHandler<E>;
};

export type ValidationScope<E extends HTMLElement> = {
  /** Null outside a Form.Root: the scope does nothing there. */
  value: ValidationScopeValue | null;
  /** Spread on the scope's element. Outside a Form.Root it is the marker alone. */
  props: ScopeHandlers<E> & { 'data-todae-validation-scope': string };
  /** Whether the scope shows an error now. */
  invalid: boolean;
  /** The id the scope's controls list in `aria-describedby`: set while the error shows and an ErrorMessage.Root is there to hold it. */
  errorId: string | undefined;
  /** What the controls inside see: the surrounding fieldset's state, with the scope's error added. */
  extend: (outer: FieldsetContextValue) => FieldsetContextValue;
};

/**
 * Makes an element a validation scope for the controls inside it, in a
 * Form.Root. It reads their native validity, decides when to show it, and hands
 * the result to its ErrorMessage.Root and to the controls' `invalid` and
 * `aria-describedby`. Inert outside a Form.Root. A scope whose own element lists
 * the error id in `aria-describedby` (`describesElement`) leaves it off its
 * controls, so the error is not announced twice.
 */
export function useValidationScope<E extends HTMLElement>(
  ref: RefObject<E | null>,
  handlers: ScopeHandlers<E>,
  { describesElement = false }: { describesElement?: boolean } = {},
): ValidationScope<E> {
  const form = useContext(FormContext);
  const strings = useStrings();
  const id = useDomId();
  const [reveal, setReveal] = useState(FRESH);
  const [readings, setReadings] = useState(NO_READINGS);
  const [messages, setMessages] = useState(0);
  const read = useRef(NO_READINGS);
  const latest = useRef<() => void>(() => undefined);
  const pending = useRef(false);

  useLayoutEffect(() => {
    latest.current = () => {
      const node = ref.current;
      if (!form || !node) return;
      const next = readScope(node, strings);
      if (sameReadings(read.current, next)) return;
      read.current = next;
      setReadings(next);
      form.refresh();
    };
  });

  const revalidate = useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    queueMicrotask(() => {
      pending.current = false;
      latest.current();
    });
  }, []);

  const epoch = form?.epoch;
  const leave = useFocusLeave(() =>
    setReveal((prev) => (prev.epoch === epoch && prev.touched && !prev.revealed ? { ...prev, revealed: true } : prev)),
  );

  // A person's edit of a control inside: the change event's way in, and useField's notifyValueChange's.
  const touch = useCallback(() => {
    if (epoch === undefined) return;
    setReveal((prev) => (prev.epoch === epoch && prev.touched ? prev : { epoch, touched: true, revealed: false }));
    revalidate();
  }, [epoch, revalidate]);

  const registerMessage = useCallback(() => {
    setMessages((count) => count + 1);
    return () => setMessages((count) => count - 1);
  }, []);

  const attempted = (form?.attempt ?? 0) > 0;
  const revealed = attempted || (reveal.epoch === form?.epoch && reveal.revealed);
  const shown = form ? pickShown(readings, form.errors, form.dismissal, revealed) : null;
  // The error's content is the dependency: a new object with the same content changes nothing.
  const kind = shown?.error.kind;
  const message = shown?.error.message;
  const error = useMemo<FormFieldError | null>(() => (kind !== undefined && message !== undefined ? { kind, message } : null), [kind, message]);

  // The page still has this scope's elements while its cleanup runs, so the summary reads once they are gone.
  const refresh = form?.refresh;
  useLayoutEffect(() => () => refresh && queueMicrotask(refresh), [refresh]);

  // After each commit of the scope: a value set with no event still changes validity.
  const on = form !== null;
  useLayoutEffect(() => {
    if (on) revalidate();
  });

  const value = useMemo<ValidationScopeValue | null>(
    () => (on ? { id, error, revalidate, touch, registerMessage } : null),
    [on, id, error, revalidate, touch, registerMessage],
  );

  const errorId = error && messages > 0 ? id : undefined;
  const invalid = error !== null;
  const extend = useCallback(
    (outer: FieldsetContextValue): FieldsetContextValue =>
      on
        ? { ...outer, invalid: outer.invalid || invalid, errorId: describesElement ? outer.errorId : (errorId ?? outer.errorId) }
        : outer,
    [on, invalid, errorId, describesElement],
  );

  // The marker is always there: a control's own fieldset is a structural fact, in a Form or not.
  if (!form) return { value: null, props: { ...handlers, [SCOPE_ATTRIBUTE]: id }, invalid: false, errorId: undefined, extend };

  const props: ValidationScope<E>['props'] = {
    [SCOPE_ATTRIBUTE]: id,
    onChangeCapture(event) {
      handlers.onChangeCapture?.(event);
      // Only a change of this scope's own control touches it: a nested scope's is that scope's, and a portaled one is not inside.
      const target = event.target;
      if (!(target instanceof Element) || target.closest(SCOPE_SELECTOR) !== event.currentTarget) return;
      touch();
    },
    onFocus(event) {
      handlers.onFocus?.(event);
      leave.onFocus();
    },
    onBlur(event) {
      handlers.onBlur?.(event);
      leave.onBlur(event);
      revalidate();
    },
  };
  return { value, props, invalid, errorId, extend };
}
