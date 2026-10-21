import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode,
  type SubmitEvent,
} from 'react';
import { useStrings } from '../providers/StringsProvider.js';
import { useDomId } from './domId.js';
import {
  FormContext,
  type Dismissal,
  type FormContextValue,
  type FormErrors,
  type SummaryEntry,
} from './Form.context.js';
import { errorsKey, failingEntries, hasEntries, SCOPE_SELECTOR, scopeControls, serverErrorFor } from './Form.model.js';
import { Button } from './Button.js';
import { Link } from './Link.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { isValidityCarrier, type FormFieldError, type ValidityCarrier } from './validity.js';
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
   * until its text for that name changes. Todae never writes to it.
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

type FormState = {
  attempt: number;
  epoch: number;
  dismissal: Dismissal;
  failed: readonly string[];
  version: number;
  /** Counts the moments focus goes to the summary or the first problem. */
  focus: number;
};
type FormAction =
  | { type: 'submit'; failed: readonly string[]; focus: boolean }
  | { type: 'draft' }
  | { type: 'reply'; failed: readonly string[] }
  | { type: 'reset'; errors: FormErrors | undefined }
  | { type: 'dismiss'; name: string; text: string }
  | { type: 'bump' }
  | { type: 'rescan' };

const NO_DISMISSAL: Dismissal = /* @__PURE__ */ new Map();
const NONE: readonly string[] = [];
const NO_ENTRIES: readonly SummaryEntry[] = [];
const INITIAL: FormState = { attempt: 0, epoch: 0, dismissal: NO_DISMISSAL, failed: NONE, version: 0, focus: 0 };

function reduce(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'submit':
      return {
        ...state,
        attempt: state.attempt + 1,
        dismissal: NO_DISMISSAL,
        failed: action.failed,
        focus: state.focus + (action.focus ? 1 : 0),
      };
    case 'draft':
      return state.dismissal.size === 0 ? state : { ...state, dismissal: NO_DISMISSAL };
    case 'reply':
      return { ...state, failed: action.failed, focus: state.focus + 1 };
    case 'reset':
      // A reset form shows nothing of the reply it had.
      return {
        ...INITIAL,
        epoch: state.epoch + 1,
        version: state.version,
        focus: state.focus,
        dismissal: new Map(Object.entries(action.errors ?? {}).filter(([, text]) => text)),
      };
    case 'dismiss':
      if (state.dismissal.get(action.name) === action.text) return state;
      return { ...state, dismissal: new Map(state.dismissal).set(action.name, action.text) };
    case 'bump':
      return state.failed.length === 0 ? state : { ...state, version: state.version + 1 };
    case 'rescan':
      return { ...state, version: state.version + 1 };
  }
}

/** The first control, in document order, that has a problem to fix: a native one, or a server error nothing has hidden. */
function firstProblem(form: HTMLFormElement, errors: FormErrors | undefined, dismissal: Dismissal): HTMLElement | undefined {
  return [...form.elements].find(
    (el): el is ValidityCarrier =>
      isValidityCarrier(el) &&
      ((el.willValidate && !el.validity.valid) || serverErrorFor(el.name, errors, dismissal) !== undefined),
  );
}

/** Development only: an entry of `errors` that no scope can show says so, once. */
function warnUnscoped(form: HTMLFormElement, errors: FormErrors, warned: Set<string>) {
  const shown = new Set<string>();
  for (const scope of form.querySelectorAll(SCOPE_SELECTOR)) for (const control of scopeControls(scope)) shown.add(control.name);
  for (const [name, text] of Object.entries(errors)) {
    if (!text || warned.has(name) || shown.has(name)) continue;
    const named = [...form.elements].some((el) => isValidityCarrier(el) && el.name === name);
    warned.add(name);
    console.warn(
      `Form.Root: errors["${name}"] shows nowhere: ${
        named ? 'its control is not inside a Field.Group or Fieldset.Root, so nothing shows it' : 'no control in the form has that name'
      }.`,
    );
  }
}

function Root({ errors, onSubmit, onReset, onChangeCapture, ref, ...props }: FormRootProps) {
  const strings = useStrings();
  const [state, dispatch] = useReducer(reduce, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const refs = useComposedRefs(formRef, ref);
  const summaryRef = useRef<HTMLElement | null>(null);
  // The content of `errors` at the last valid submit, until the person edits, the form resets, or a reply arrives.
  const awaiting = useRef<string | null>(null);
  const resetTimer = useRef<number | undefined>(undefined);
  const warned = useRef(new Set<string>());
  const key = errorsKey(errors);

  const bump = useCallback(() => dispatch({ type: 'bump' }), []);
  const rescan = useCallback(() => dispatch({ type: 'rescan' }), []);

  const ctx = useMemo<FormContextValue>(
    () => ({
      attempt: state.attempt,
      epoch: state.epoch,
      errors,
      dismissal: state.dismissal,
      failed: state.failed,
      version: state.version,
      formRef,
      summaryRef,
      bump,
      rescan,
    }),
    [state.attempt, state.epoch, state.dismissal, state.failed, state.version, errors, bump, rescan],
  );

  // The summary if one is showing, else the control.
  useLayoutEffect(() => {
    if (state.focus === 0) return;
    const form = formRef.current;
    if (form) (summaryRef.current ?? firstProblem(form, errors, state.dismissal))?.focus();
    // Only a new request moves focus; the rest is read as it is now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.focus]);

  // A reply is errors whose content differs from what they were at the submit; the same content in a new object, or none, is not.
  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form || awaiting.current === null) return;
    // Cleared errors are what the next reply is measured against.
    if (!hasEntries(key)) {
      awaiting.current = key;
      return;
    }
    if (key === awaiting.current) return;
    awaiting.current = null;
    dispatch({ type: 'reply', failed: failingEntries(form, errors, state.dismissal, strings).map((entry) => entry.scopeId) });
    // Only a change of content is a reply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && errors && formRef.current) warnUnscoped(formRef.current, errors, warned.current);
  }, [errors]);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    // A portaled form inside this one bubbles its submit through it; that one is not ours to check or to hand on.
    if (event.target !== event.currentTarget) return;
    const submitter = event.nativeEvent.submitter;
    // As natively, a button with formNoValidate sends the form without the check: a send, not an attempt.
    if (submitter && 'formNoValidate' in submitter && submitter.formNoValidate) {
      awaiting.current = key;
      dispatch({ type: 'draft' });
      return onSubmit?.(event);
    }
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      event.preventDefault();
      awaiting.current = null;
      dispatch({ type: 'submit', failed: failingEntries(form, errors, NO_DISMISSAL, strings).map((entry) => entry.scopeId), focus: true });
      return;
    }
    awaiting.current = key;
    dispatch({ type: 'submit', failed: NONE, focus: false });
    onSubmit?.(event);
  }

  return (
    <FormContext.Provider value={ctx}>
      <form
        {...props}
        ref={refs}
        noValidate
        onSubmit={submit}
        onChangeCapture={(event) => {
          onChangeCapture?.(event);
          // A portaled control's change is not an edit of this form.
          const target = event.target;
          if (!(target instanceof Node) || !event.currentTarget.contains(target)) return;
          // An edit is the answer to a reply that hasn't come yet.
          awaiting.current = null;
          if (!isValidityCarrier(target)) return;
          const text = errors?.[target.name];
          if (text) dispatch({ type: 'dismiss', name: target.name, text });
        }}
        onReset={composeHandlers(onReset, (event) => {
          // A portaled form's reset bubbles through this one.
          if (event.target !== event.currentTarget) return;
          dispatch({ type: 'reset', errors });
          awaiting.current = null;
          // The browser applies the reset after this event, so what the scopes read now is stale.
          window.clearTimeout(resetTimer.current);
          resetTimer.current = window.setTimeout(() => dispatch({ type: 'rescan' }));
        })}
      />
    </FormContext.Provider>
  );
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
  const refs = useComposedRefs(form.summaryRef, ref);
  const root = form.formRef.current;
  // Read from the page as it is: what failed at the last attempt, less what is fixed or gone since. `version` says when to read again.
  const entries =
    root && form.failed.length > 0 ? failingEntries(root, form.errors, form.dismissal, strings, new Set(form.failed)) : NO_ENTRIES;
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
          {entries.map((entry, i) => {
            const field = fields[i];
            return (
              <li key={entry.scopeId} className={styles.item}>
                {entry.carrier.id ? (
                  <Link.Root
                    href={`#${entry.carrier.id}`}
                    onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                      event.preventDefault();
                      field?.focus();
                    }}
                  >
                    {entry.label}
                  </Link.Root>
                ) : (
                  // An `a` with no href is not a link and can't be focused, so a control with no id gets a button.
                  <Button.Root variant="ghost" onClick={() => field?.focus()}>
                    {entry.label}
                  </Button.Root>
                )}
                <span>{entry.error.message}</span>
              </li>
            );
          })}
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
