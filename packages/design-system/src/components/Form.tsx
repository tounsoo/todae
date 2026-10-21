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
import { failingEntries, sameEntries, SCOPE_SELECTOR, serverErrorFor } from './Form.model.js';
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
  summary: readonly SummaryEntry[];
  /** Counts the moments focus goes to the summary or the first problem. */
  focus: number;
};
type FormAction =
  | { type: 'submit'; summary: readonly SummaryEntry[]; focus: boolean }
  | { type: 'reset'; errors: FormErrors | undefined }
  | { type: 'dismiss'; name: string; text: string }
  | { type: 'summary'; summary: readonly SummaryEntry[]; focus: boolean };

const NO_DISMISSAL: Dismissal = /* @__PURE__ */ new Map();
const INITIAL: FormState = { attempt: 0, epoch: 0, dismissal: NO_DISMISSAL, summary: [], focus: 0 };

function reduce(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'submit':
      return {
        ...state,
        attempt: state.attempt + 1,
        dismissal: NO_DISMISSAL,
        summary: action.summary,
        focus: state.focus + (action.focus ? 1 : 0),
      };
    case 'reset':
      // A reset form shows nothing of the reply it had.
      return {
        ...INITIAL,
        epoch: state.epoch + 1,
        focus: state.focus,
        dismissal: new Map(Object.entries(action.errors ?? {}).filter(([, text]) => text)),
      };
    case 'dismiss': {
      if (state.dismissal.get(action.name) === action.text) return state;
      return { ...state, dismissal: new Map(state.dismissal).set(action.name, action.text) };
    }
    case 'summary':
      return { ...state, summary: action.summary, focus: state.focus + (action.focus ? 1 : 0) };
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

/** Development only: an entry of `errors` that no scope can show says so, once. */
function warnUnscoped(form: HTMLFormElement, errors: FormErrors, warned: Set<string>) {
  for (const [name, text] of Object.entries(errors)) {
    if (!text || warned.has(name)) continue;
    const controls = [...form.elements].filter((el) => isValidityCarrier(el) && el.name === name);
    const reason =
      controls.length === 0
        ? 'no control in the form has that name'
        : controls.some((el) => el.closest(SCOPE_SELECTOR))
          ? undefined
          : 'its control is not inside a Field.Group or Fieldset.Root, so nothing shows it';
    if (!reason) continue;
    warned.add(name);
    console.warn(`Form.Root: errors["${name}"] shows nowhere: ${reason}.`);
  }
}

function Root({ errors, onSubmit, onReset, onChangeCapture, ref, ...props }: FormRootProps) {
  const strings = useStrings();
  const [state, dispatch] = useReducer(reduce, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const refs = useComposedRefs(formRef, ref);
  const summaryRef = useRef<HTMLElement | null>(null);
  // From a valid submit until the person edits, the form resets, or a reply with entries arrives.
  const awaiting = useRef(false);
  const warned = useRef(new Set<string>());
  const latest = useRef({ errors, dismissal: state.dismissal, summary: state.summary, strings });
  useLayoutEffect(() => {
    latest.current = { errors, dismissal: state.dismissal, summary: state.summary, strings };
  });

  const dismiss = useCallback(
    (name: string) => {
      const text = errors?.[name];
      if (!text || state.dismissal.get(name) === text) return;
      dispatch({ type: 'dismiss', name, text });
    },
    [errors, state.dismissal],
  );

  const recheck = useCallback(() => {
    const form = formRef.current;
    const { errors, dismissal, summary, strings } = latest.current;
    if (!form || summary.length === 0) return;
    const next = failingEntries(form, errors, dismissal, strings, new Set(summary.map((entry) => entry.scopeId)));
    if (!sameEntries(summary, next)) dispatch({ type: 'summary', summary: next, focus: false });
  }, []);

  const ctx = useMemo<FormContextValue>(
    () => ({
      attempt: state.attempt,
      epoch: state.epoch,
      errors,
      dismissal: state.dismissal,
      dismiss,
      summary: state.summary,
      summaryRef,
      recheck,
    }),
    [state.attempt, state.epoch, state.dismissal, state.summary, errors, dismiss, recheck],
  );

  // The summary lists what is failing, and drops what an edit or a new reply has settled.
  useLayoutEffect(() => recheck(), [errors, state.dismissal, recheck]);

  // The summary if one is showing, else the control.
  useLayoutEffect(() => {
    if (state.focus === 0) return;
    const form = formRef.current;
    if (form) (summaryRef.current ?? firstProblem(form, errors, state.dismissal))?.focus();
    // Only a new request moves focus; the rest is read as it is now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.focus]);

  // A reply with errors to a valid submit: they take focus, as a failed submit's do.
  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form || !awaiting.current || !hasEntries(errors)) return;
    awaiting.current = false;
    dispatch({ type: 'summary', summary: failingEntries(form, errors, state.dismissal, strings), focus: true });
    // Only a new `errors` is a reply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && errors && formRef.current) warnUnscoped(formRef.current, errors, warned.current);
  }, [errors]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    // A portaled form inside this one bubbles its submit through it; that one is not ours to check or to hand on.
    if (event.target !== event.currentTarget) return;
    const submitter = event.nativeEvent.submitter;
    // As natively, a button with formNoValidate sends the form without the check.
    if (submitter && 'formNoValidate' in submitter && submitter.formNoValidate) return onSubmit?.(event);
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      event.preventDefault();
      awaiting.current = false;
      dispatch({ type: 'submit', summary: failingEntries(form, errors, NO_DISMISSAL, strings), focus: true });
      return;
    }
    awaiting.current = true;
    dispatch({ type: 'submit', summary: [], focus: false });
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
          // An edit is the answer to a reply that hasn't come yet.
          awaiting.current = false;
        }}
        onReset={composeHandlers(onReset, () => {
          dispatch({ type: 'reset', errors });
          awaiting.current = false;
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
  const { summary } = form;
  if (summary.length === 0) return null;
  const rows = summary.map((entry) => ({
    entry,
    field: {
      name: entry.carrier.name || undefined,
      label: entry.label,
      error: entry.error,
      focus: () => entry.carrier.focus(),
    } satisfies FormInvalidField,
  }));
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
        {title ?? strings.formErrors(summary.length)}
      </p>
      {children ? (
        children(rows.map((row) => row.field))
      ) : (
        <ul className={styles.list}>
          {rows.map(({ entry, field }) => (
            <li key={entry.scopeId} className={styles.item}>
              <Link.Root
                href={`#${entry.carrier.id}`}
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
