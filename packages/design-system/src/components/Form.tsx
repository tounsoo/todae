import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode,
  type SubmitEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { useStrings } from '../providers/StringsProvider.js';
import { useDomId } from './domId.js';
import {
  createFormStore,
  FormContext,
  type Dismissal,
  type FormContextValue,
  type FormErrors,
  type FormStore,
} from './Form.context.js';
import { serverErrorFor } from './Form.model.js';
import { Link } from './Link.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { isValidityCarrier, type FormFieldError } from './validity.js';
import styles from './Form.module.css';

export type { FormErrors } from './Form.context.js';

/**
 * A native `<form>` that reports validity for the controls inside it. It sets
 * `noValidate`, so the browser's own bubbles stay away while Todae shows each
 * problem in the page's language.
 */
export type FormRootProps = {
  /**
   * Problems you found, such as a server's reply, keyed by a control's `name`.
   * They show at once in place of the control's native problem, never block a
   * submit, and an edit to the control hides its entry until the next submit or
   * until `errors` is a new object. Todae never writes to it.
   */
  errors?: FormErrors;
  /**
   * Runs for a submit with every control valid, or one sent by a submit button
   * with `formNoValidate`. Todae's own check runs before it, and a submit with
   * a problem never reaches it.
   */
  onSubmit?: ComponentPropsWithRef<'form'>['onSubmit'];
} & Omit<ComponentPropsWithRef<'form'>, 'noValidate' | 'onSubmit'>;

/** A control that failed, as `Form.Summary` hands it to a function child. */
export type FormInvalidField = {
  name: string | undefined;
  /** The control's name for a person: its fieldset's legend, label, `aria-labelledby` or `aria-label`. */
  label: string;
  error: FormFieldError;
  /** Moves focus to the control. */
  focus: () => void;
};

export type FormSummaryProps = {
  /** Replaces the title, which is the `formErrors` string with the count. */
  title?: ReactNode;
  /** Replaces the default list of links. */
  children?: (fields: readonly FormInvalidField[]) => ReactNode;
} & Omit<ComponentPropsWithRef<'div'>, 'children' | 'title'>;

type FormState = { attempt: number; epoch: number; dismissal: Dismissal };
type FormAction =
  | { type: 'submit' }
  | { type: 'reset' }
  | { type: 'dismiss'; name: string; errors: FormErrors | undefined };

const NO_DISMISSAL: Dismissal = { errors: undefined, names: /* @__PURE__ */ new Set() };

function reduce(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'submit':
      return { ...state, attempt: state.attempt + 1, dismissal: NO_DISMISSAL };
    case 'reset':
      return { attempt: 0, epoch: state.epoch + 1, dismissal: NO_DISMISSAL };
    case 'dismiss': {
      const { dismissal } = state;
      if (dismissal.errors === action.errors && dismissal.names.has(action.name)) return state;
      const names = new Set(dismissal.errors === action.errors ? dismissal.names : []);
      names.add(action.name);
      return { ...state, dismissal: { errors: action.errors, names } };
    }
  }
}

const hasEntries = (errors: FormErrors | undefined) => errors !== undefined && Object.values(errors).some(Boolean);

/** The first control, in document order, that has a problem to fix: a native one, or a server error nothing has hidden. */
function firstProblem(form: HTMLFormElement, errors: FormErrors | undefined, dismissal: Dismissal): HTMLElement | undefined {
  return [...form.elements].find(
    (el): el is HTMLElement =>
      isValidityCarrier(el) &&
      el.willValidate &&
      (!el.validity.valid || serverErrorFor(el.name, errors, dismissal) !== undefined),
  );
}

function Root({ errors, onSubmit, onReset, onChangeCapture, className, ref, ...props }: FormRootProps) {
  const [state, dispatch] = useReducer(reduce, { attempt: 0, epoch: 0, dismissal: NO_DISMISSAL });
  const [store] = useState(createFormStore);
  const formRef = useRef<HTMLFormElement>(null);
  const refs = useComposedRefs(formRef, ref);
  // Set by a submit with a problem, and by a reply that brings errors after a valid one; read after the commit it causes.
  const focusNext = useRef(false);
  // From a valid submit until the person edits or the reply arrives.
  const awaiting = useRef(false);

  const dismiss = useCallback((name: string) => dispatch({ type: 'dismiss', name, errors }), [errors]);
  const ctx = useMemo<FormContextValue>(
    () => ({ attempt: state.attempt, epoch: state.epoch, errors, dismissal: state.dismissal, dismiss, store }),
    [state.attempt, state.epoch, state.dismissal, errors, dismiss, store],
  );

  // Once every scope has read and reported, list what is failing and move focus to it: the summary if one is showing, else the control.
  const focusProblem = useCallback(() => {
    queueMicrotask(() => {
      const form = formRef.current;
      if (!form?.isConnected) return;
      flushSync(() => store.freeze('failing'));
      const summary = store.summary();
      (summary ?? firstProblem(form, errors, state.dismissal))?.focus();
    });
  }, [store, errors, state.dismissal]);

  useLayoutEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    focusProblem();
    // Only a new attempt asks for focus; the callback is read when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attempt]);

  // A reply to a valid submit: its errors take focus, as a failed submit's do.
  useLayoutEffect(() => {
    if (!awaiting.current) return;
    awaiting.current = false;
    if (!hasEntries(errors)) return;
    focusProblem();
    // Only a new `errors` is a reply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    // A portaled form inside this one bubbles its submit through it; that one is not ours to check.
    if (event.target !== event.currentTarget) return onSubmit?.(event);
    const submitter = event.nativeEvent.submitter;
    // As natively, a button with formNoValidate sends the form without the check.
    if (submitter && 'formNoValidate' in submitter && submitter.formNoValidate) return onSubmit?.(event);
    dispatch({ type: 'submit' });
    if (!event.currentTarget.checkValidity()) {
      event.preventDefault();
      awaiting.current = false;
      focusNext.current = true;
      return;
    }
    awaiting.current = true;
    store.freeze('none');
    onSubmit?.(event);
  }

  return (
    <FormContext.Provider value={ctx}>
      <form
        {...props}
        ref={refs}
        noValidate
        className={className}
        onSubmit={submit}
        onChangeCapture={(event) => {
          onChangeCapture?.(event);
          // An edit is the answer to a reply that hasn't come yet.
          awaiting.current = false;
        }}
        onReset={composeHandlers(onReset, () => {
          dispatch({ type: 'reset' });
          awaiting.current = false;
          store.freeze('none');
        })}
      />
    </FormContext.Provider>
  );
}

function useFormStore(store: FormStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * The problems a failed submit left, as links to the controls. A failed
 * submit moves focus here, so a screen reader hears the count and the list;
 * without a summary, focus goes to the first control with a problem. It lists
 * what failed at the last attempt, drops each as it is fixed, and renders
 * nothing when none is left.
 */
function Summary({ title, children, className, ref, ...props }: FormSummaryProps) {
  const form = useFormContext('Form.Summary');
  const strings = useStrings();
  const titleId = useDomId();
  const entries = useFormStore(form.store);
  const refs = useComposedRefs(form.store.setSummary, ref);
  if (entries.length === 0) return null;
  const fields = entries.map(
    (entry): FormInvalidField => ({
      name: entry.carrier.name || undefined,
      label: entry.label,
      error: entry.error,
      focus: () => entry.carrier.focus(),
    }),
  );
  return (
    <div
      {...props}
      ref={refs}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      className={cx(styles.summary, className)}
    >
      <p id={titleId} className={styles.title}>
        {title ?? strings.formErrors(entries.length)}
      </p>
      {children ? (
        children(fields)
      ) : (
        <ul className={styles.list}>
          {fields.map((field, i) => (
            <li key={entries[i]!.scopeId} className={styles.item}>
              <Link.Root
                href={`#${entries[i]!.carrier.id}`}
                onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                  event.preventDefault();
                  field.focus();
                }}
              >
                {field.label}
              </Link.Root>
              <span>{field.error.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useFormContext(part: string): FormContextValue {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error(`${part} must be rendered inside Form.Root`);
  return ctx;
}

export const Form = { Root, Summary } as const;
