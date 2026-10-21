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
import { flushSync } from 'react-dom';
import { useStrings } from '../providers/StringsProvider.js';
import { useDomId } from './domId.js';
import { FormContext, type Reading, type ValidationScopeValue } from './Form.context.js';
import { labelOf, pickShown, sameReadings, scopeCarriers, SCOPE_SELECTOR } from './Form.model.js';
import type { FieldsetContextValue } from './Fieldset.context.js';
import { describeValidity, isValidityCarrier, type FormFieldError } from './validity.js';

export { SCOPE_SELECTOR };

/** When a scope started to show what its controls say: after a change and the focus leaving, per reset. */
type Reveal = { epoch: number; touched: boolean; revealed: boolean };

const NO_READINGS: readonly Reading[] = [];
const FRESH: Reveal = { epoch: 0, touched: false, revealed: false };

type ScopeHandlers<E extends HTMLElement> = {
  onChangeCapture?: FormEventHandler<E>;
  onBlur?: FocusEventHandler<E>;
};

export type ValidationScope<E extends HTMLElement> = {
  /** Null outside a Form.Root: the scope does nothing there. */
  value: ValidationScopeValue | null;
  /** Spread on the scope's element. Empty outside a Form.Root. */
  props: ScopeHandlers<E> & { 'data-todae-validation-scope'?: '' };
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
 * `aria-describedby`. Inert outside a Form.Root.
 */
export function useValidationScope<E extends HTMLElement>(
  ref: RefObject<E | null>,
  handlers: ScopeHandlers<E>,
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

  latest.current = () => {
    const node = ref.current;
    if (!form || !node) return;
    const next = scopeCarriers(node).map(
      (carrier): Reading => ({
        carrier,
        name: carrier.name,
        native: describeValidity(carrier, strings),
        label: labelOf(carrier, node),
      }),
    );
    if (sameReadings(read.current, next)) return;
    read.current = next;
    // Flushed, so whatever waits on the scope's error, such as the focus after a failed submit, sees it.
    flushSync(() => setReadings(next));
  };

  const revalidate = useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    queueMicrotask(() => {
      pending.current = false;
      latest.current();
    });
  }, []);

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

  // After each commit of the scope: a value set with no event still changes validity.
  const on = form !== null;
  useLayoutEffect(() => {
    if (on) revalidate();
  });

  const store = form?.store;
  const carrier = shown?.reading.carrier;
  const label = shown?.reading.label;
  useLayoutEffect(() => {
    if (!store) return;
    store.report(id, error && carrier ? { scopeId: id, error, label: label ?? '', carrier } : null);
  }, [store, id, error, carrier, label]);
  useLayoutEffect(() => () => store?.report(id, null), [store, id]);

  const value = useMemo<ValidationScopeValue | null>(
    () => (on ? { id, error, revalidate, registerMessage } : null),
    [on, id, error, revalidate, registerMessage],
  );

  const errorId = error && messages > 0 ? id : undefined;
  const invalid = error !== null;
  const extend = useCallback(
    (outer: FieldsetContextValue): FieldsetContextValue =>
      on ? { ...outer, invalid: outer.invalid || invalid, errorId: errorId ?? outer.errorId } : outer,
    [on, invalid, errorId],
  );

  if (!form) return { value: null, props: handlers, invalid: false, errorId: undefined, extend };

  const props: ValidationScope<E>['props'] = {
    'data-todae-validation-scope': '',
    onChangeCapture(event) {
      handlers.onChangeCapture?.(event);
      const target = event.target;
      if (isValidityCarrier(target)) form.dismiss(target.name);
      setReveal((prev) => (prev.epoch === form.epoch && prev.touched ? prev : { epoch: form.epoch, touched: true, revealed: false }));
      revalidate();
    },
    onBlur(event) {
      handlers.onBlur?.(event);
      const next = event.relatedTarget;
      const leaving = !(next instanceof Node && event.currentTarget.contains(next));
      if (leaving) {
        setReveal((prev) => (prev.epoch === form.epoch && prev.touched && !prev.revealed ? { ...prev, revealed: true } : prev));
      }
      revalidate();
    },
  };
  return { value, props, invalid, errorId, extend };
}
