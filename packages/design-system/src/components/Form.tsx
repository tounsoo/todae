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
import type { Strings } from '../providers/strings.js';
import { useDomId } from './domId.js';
import {
  FormContext,
  type Dismissal,
  type FormContextValue,
  type FormErrors,
  type SummaryEntry,
} from './Form.context.js';
import { errorsKey, failingEntries, keyHasErrors, sameEntry, scopedControls } from './Form.model.js';
import { Button } from './Button.js';
import { Link } from './Link.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { warnOnce } from './warnOnce.js';
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
   * Todae never writes to it: clear it when you send, in `onSubmit`, and set it
   * when the reply comes.
   *
   * ```tsx
   * onSubmit={async (event) => {
   *   event.preventDefault();
   *   setErrors({});
   *   setErrors(await createAccount(new FormData(event.currentTarget)));
   * }}
   * ```
   *
   * Entries show at once in place of the control's native problem and never
   * block a submit. An edit to a control hides its entry until the next
   * submit, or until `errors` drops that name or changes its text; a hidden
   * entry is forgotten as soon as it leaves `errors`. After a send, a reply is
   * a commit whose content differs from the commit before and has entries
   * (clear-then-set counts; a rebuild of the same content does not). It lists
   * and focuses only server errors, on the summary or the first enabled
   * control.
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
  /** Whether the control is disabled, itself or through a disabled fieldset: it can't take focus. */
  disabled: boolean;
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
  failed: readonly SummaryEntry[];
  /** Counts the moments focus goes to the summary or the first problem. */
  focus: number;
  /** Whether native problems count, for focus and for what the summary keeps: after a failed submit, not after a reply or a send without the check. */
  native: boolean;
};
type FormAction =
  | { type: 'submit'; failed: readonly SummaryEntry[]; focus: boolean }
  | { type: 'draft' }
  | { type: 'reply'; failed: readonly SummaryEntry[] }
  | { type: 'reset'; errors: FormErrors | undefined }
  | { type: 'dismiss'; name: string; text: string }
  | { type: 'forget'; errors: FormErrors | undefined }
  | { type: 'refresh'; entries: readonly SummaryEntry[] };

const NO_DISMISSAL: Dismissal = /* @__PURE__ */ new Map();
const NONE: readonly SummaryEntry[] = [];
const INITIAL: FormState = { attempt: 0, epoch: 0, dismissal: NO_DISMISSAL, failed: NONE, focus: 0, native: true };

function reduce(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'submit':
      return {
        ...state,
        attempt: state.attempt + 1,
        dismissal: NO_DISMISSAL,
        failed: action.failed,
        focus: state.focus + (action.focus ? 1 : 0),
        native: true,
      };
    case 'draft':
      return state.dismissal.size === 0 ? state : { ...state, dismissal: NO_DISMISSAL };
    case 'reply':
      return { ...state, failed: action.failed, focus: state.focus + 1, native: false };
    case 'reset':
      // A reset form shows nothing of the reply it had.
      return {
        ...INITIAL,
        epoch: state.epoch + 1,
        focus: state.focus,
        dismissal: new Map(Object.entries(action.errors ?? {}).filter(([, text]) => text)),
      };
    case 'dismiss':
      if (state.dismissal.get(action.name) === action.text) return state;
      return { ...state, dismissal: new Map(state.dismissal).set(action.name, action.text) };
    case 'forget': {
      // An entry that left `errors`, or changed its text, is no longer one the person hid.
      const kept = [...state.dismissal].filter(([name, text]) => action.errors?.[name] === text);
      return kept.length === state.dismissal.size ? state : { ...state, dismissal: new Map(kept) };
    }
    case 'refresh': {
      // Membership only shrinks: what failed and is fixed is gone, and what is fixed and broken again waits for the next submit.
      const now = new Map(action.entries.map((entry) => [entry.scopeId, entry]));
      const failed = state.failed.flatMap((entry) => now.get(entry.scopeId) ?? []);
      const same = failed.length === state.failed.length && failed.every((entry, i) => sameEntry(entry, state.failed[i]!));
      return same ? state : { ...state, failed };
    }
  }
}

/**
 * The first enabled control, in document order, that has a problem to fix: a
 * control in a scope only when it is the one the scope shows, else, with
 * `native`, a native problem of a control no scope reads.
 */
function firstProblem(
  form: HTMLFormElement,
  errors: FormErrors | undefined,
  dismissal: Dismissal,
  strings: Strings,
  native: boolean,
): HTMLElement | undefined {
  const read = scopedControls(form);
  // Every scope speaks for its controls through the one it shows; a disabled one can't take focus, and the others stay quiet.
  const shown = new Set<Element>(failingEntries(form, errors, dismissal, strings, native).map((entry) => entry.reading.carrier));
  return [...form.elements].find(
    (el): el is ValidityCarrier =>
      isValidityCarrier(el) &&
      !el.matches(':disabled') &&
      (read.has(el) ? shown.has(el) : native && el.willValidate && !el.validity.valid),
  );
}

/** Development only: an entry of `errors` that no scope can show says so, once. A name no control has yet gets one more task, since a control may mount just after the reply. */
function warnUnscoped(formId: string, form: HTMLFormElement, errors: FormErrors) {
  const check = (final: boolean) => {
    if (!form.isConnected) return;
    const shown = new Set([...scopedControls(form)].map((control) => (control as ValidityCarrier).name));
    let missing = false;
    for (const [name, text] of Object.entries(errors)) {
      if (!text || shown.has(name)) continue;
      const named = [...form.elements].some((el) => isValidityCarrier(el) && el.name === name);
      if (!named && !final) {
        missing = true;
        continue;
      }
      warnOnce(
        `unscoped:${formId}:${name}`,
        `Form.Root: errors["${name}"] shows nowhere: ${
          named ? 'its control is not inside a Field.Group or Fieldset.Root, so nothing shows it' : 'no control in the form has that name'
        }.`,
      );
    }
    if (missing) window.setTimeout(() => check(true));
  };
  check(false);
}

function Root({ errors, onSubmit, onReset, onChangeCapture, ref, ...props }: FormRootProps) {
  const strings = useStrings();
  const [state, dispatch] = useReducer(reduce, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const refs = useComposedRefs(formRef, ref);
  const summaryRef = useRef<HTMLElement | null>(null);
  // Whether a send is waiting for its reply, until the person edits, the form resets, or a reply arrives.
  const awaiting = useRef(false);
  const resetTimer = useRef<number | undefined>(undefined);
  const formId = useDomId();
  const key = errorsKey(errors);
  // What `refresh` reads, as of the last commit: it is called from events and effects of other components.
  const latest = useRef({ errors, state, strings });
  useLayoutEffect(() => {
    latest.current = { errors, state, strings };
  });

  const refresh = useCallback(() => {
    const form = formRef.current;
    const { errors, state, strings } = latest.current;
    if (!form || state.failed.length === 0) return;
    dispatch({ type: 'refresh', entries: failingEntries(form, errors, state.dismissal, strings, state.native) });
  }, []);

  const ctx = useMemo<FormContextValue>(
    () => ({
      attempt: state.attempt,
      epoch: state.epoch,
      errors,
      dismissal: state.dismissal,
      failed: state.failed,
      formRef,
      summaryRef,
      refresh,
    }),
    [state.attempt, state.epoch, state.dismissal, state.failed, errors, refresh],
  );

  // The summary if one is showing, else the control.
  useLayoutEffect(() => {
    if (state.focus === 0) return;
    const form = formRef.current;
    if (form) (summaryRef.current ?? firstProblem(form, errors, state.dismissal, strings, state.native))?.focus();
    // Only a new request moves focus; the rest is read as it is now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.focus]);

  // A reply is a commit whose `errors` differ in content from the commit before and have entries; the same content in a new object does not run this.
  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form || !awaiting.current || !keyHasErrors(key)) return;
    awaiting.current = false;
    // Only server errors: a reply doesn't reach for problems the person hasn't got to.
    dispatch({ type: 'reply', failed: failingEntries(form, errors, state.dismissal, strings, false) });
    // By now the form shows what it has.
    if (process.env.NODE_ENV !== 'production' && errors) warnUnscoped(formId, form, errors);
    // Only a change of content is a reply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // What `errors` or an edit changed may change the summary's rows.
  useLayoutEffect(() => {
    dispatch({ type: 'forget', errors });
    refresh();
    // The content is the dependency, not the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state.dismissal, refresh]);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    // A portaled form inside this one bubbles its submit through it; that one is not ours to check or to hand on.
    if (event.target !== event.currentTarget) return;
    const submitter = event.nativeEvent.submitter;
    // As natively, a button with formNoValidate sends the form without the check: a send, not an attempt.
    if (submitter && 'formNoValidate' in submitter && submitter.formNoValidate) {
      awaiting.current = true;
      dispatch({ type: 'draft' });
      return onSubmit?.(event);
    }
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      event.preventDefault();
      awaiting.current = false;
      dispatch({ type: 'submit', failed: failingEntries(form, errors, NO_DISMISSAL, strings, true), focus: true });
      return;
    }
    awaiting.current = true;
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
          awaiting.current = false;
          if (!isValidityCarrier(target)) return;
          const text = errors?.[target.name];
          if (text) dispatch({ type: 'dismiss', name: target.name, text });
        }}
        onReset={(event) => {
          // A portaled form's reset bubbles through this one, and is not this form's to hear.
          if (event.target !== event.currentTarget) return;
          composeHandlers(onReset, () => {
            awaiting.current = false;
            dispatch({ type: 'reset', errors });
            // The browser applies the reset after the handlers return and before any timer, so what the scopes read now is stale: reset again once it has, which has them read again.
            window.clearTimeout(resetTimer.current);
            resetTimer.current = window.setTimeout(() => dispatch({ type: 'reset', errors }));
          })(event);
        }}
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
  const entries = form.failed;
  if (entries.length === 0) return null;
  const fieldOf = (entry: SummaryEntry): FormInvalidField => ({
    name: entry.reading.name || undefined,
    label: entry.reading.label,
    error: entry.error,
    disabled: entry.reading.disabled,
    focus: () => entry.reading.carrier.focus(),
  });
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
        children(entries.map(fieldOf))
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.scopeId} className={styles.item}>
              {entry.reading.disabled ? (
                // A disabled control can't take focus, so its row says what is wrong and offers nothing to press.
                <span>{entry.reading.label}</span>
              ) : entry.reading.id ? (
                <Link.Root
                  href={`#${entry.reading.id}`}
                  onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                    event.preventDefault();
                    fieldOf(entry).focus();
                  }}
                >
                  {entry.reading.label}
                </Link.Root>
              ) : (
                // An `a` with no href is not a link and can't be focused, so a control with no id gets a button.
                <Button.Root variant="ghost" onClick={fieldOf(entry).focus}>
                  {entry.reading.label}
                </Button.Root>
              )}
              <span>{entry.error.message}</span>
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
