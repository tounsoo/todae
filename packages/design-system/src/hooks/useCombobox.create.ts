import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import type { ComboboxFieldState } from './useCombobox.state.js';

type CreateResult = string | void | Promise<string | void>;

/**
 * An async create in flight: live, or dropped by `cancel`. Running its label
 * again takes a dropped one back, unless its `controller` was aborted.
 * `startValue` is the single value when it started, or when it was taken back.
 */
type CreateRequest = { label: string; startValue: string | null; dropped: boolean; controller: AbortController };

const NONE: ReadonlySet<string> = new Set();

/** Whether the text asks for `label`: trimmed and case-insensitive, as the create row matches. */
export function readsLabel(text: string, label: string): boolean {
  return text.trim().toLowerCase() === label.trim().toLowerCase();
}

const keyOf = (label: string) => label.trim().toLowerCase();

/**
 * What a failure reads as: its reason, or an Error when it has none, so
 * `reject()` and `throw undefined` still read as a failure next to `null`.
 */
export function failureOf(reason: unknown, source: string): unknown {
  return reason ?? new Error(`${source} failed without a reason`);
}

/**
 * Hands a throw from the caller's code after an await to the page's error
 * reporting, as a throw from an event handler would be, rather than leaving it
 * an unhandled rejection. Without `reportError`, as in jsdom, it throws.
 */
function report(thrown: unknown): void {
  if (typeof globalThis.reportError !== 'function') throw thrown;
  globalThis.reportError(thrown);
}

/**
 * Whether a live request, as it settles, still speaks for the field. In multiple
 * mode it always does, and its chip is added whatever the user did since. In
 * single mode it does only while the text reads its label and the value is the
 * one it started from.
 */
function holds(request: CreateRequest, text: string, single: string | null, multiple: boolean): boolean {
  return multiple || (readsLabel(text, request.label) && Object.is(single, request.startValue));
}

/**
 * The async creates in flight, one per label, and the last one's failure. A request
 * stays in flight until its promise settles, so its label never runs `onCreate`
 * twice. Only a live one counts in `creating`, and only a live one that still holds
 * commits or reports when it settles.
 */
export function useComboboxCreate(multiple: boolean, inputValue: string, state: RefObject<ComboboxFieldState>) {
  const requests = useRef(new Map<string, CreateRequest>());
  // The labels of the live requests, for rendering.
  const [live, setLive] = useState(NONE);
  const [error, setError] = useState<unknown | null>(null);
  // Any change to the text, the hook's or a controlled owner's, clears the last failure.
  const [errorText, setErrorText] = useState(inputValue);
  if (errorText !== inputValue) {
    setErrorText(inputValue);
    setError(null);
  }

  const sync = useCallback(() => {
    const keys = [...requests.current].filter(([, request]) => !request.dropped).map(([key]) => key);
    setLive(keys.length === 0 ? NONE : new Set(keys));
  }, []);

  /**
   * Runs `start`, and hands its result to `commit`. While a create for `label` is
   * pending it runs nothing, and takes that create back if it was dropped, unless
   * its signal was aborted: then it runs `start` again. A throw from `start`, or
   * its rejection, is the create's failure; a throw from `commit` is the caller's,
   * and after an await it goes to `reportError`.
   */
  const run = useCallback(
    (
      label: string,
      start: (signal: AbortSignal) => CreateResult | undefined,
      commit: (canonical: string | void) => void,
    ) => {
      const key = keyOf(label);
      const now = () => state.current;
      const pending = requests.current.get(key);
      if (pending && !pending.controller.signal.aborted) {
        if (pending.dropped) {
          pending.dropped = false;
          pending.startValue = now().single;
          sync();
        }
        return;
      }
      if (pending) requests.current.delete(key);
      setError(null);
      const controller = new AbortController();
      let result: CreateResult | undefined;
      try {
        result = start(controller.signal);
      } catch (reason) {
        setError(failureOf(reason, 'onCreate'));
        return;
      }
      if (!isThenable(result)) {
        commit(result);
        return;
      }
      const request: CreateRequest = { label, startValue: now().single, dropped: false, controller };
      requests.current.set(key, request);
      sync();
      const settle = () => {
        if (requests.current.get(key) !== request) return false;
        requests.current.delete(key);
        sync();
        return !request.dropped && holds(request, now().inputValue, now().single, multiple);
      };
      void Promise.resolve(result).then(
        (canonical) => {
          // Rendered at once, so a controlled owner's new value is what the next
          // create to settle in this tick builds on.
          try {
            flushSync(() => {
              if (settle()) commit(canonical);
            });
          } catch (thrown) {
            report(thrown);
          }
        },
        (reason: unknown) => {
          // Reported only while the text still asks for this label.
          if (settle() && readsLabel(now().inputValue, label)) setError(failureOf(reason, 'onCreate'));
        },
      );
    },
    [multiple, state, sync],
  );

  const cancel = useCallback(() => {
    for (const request of requests.current.values()) request.dropped = true;
    sync();
  }, [sync]);

  const clearError = useCallback(() => setError(null), []);

  // Unmounting, or an Activity hiding the field, drops every request and aborts
  // its signal, since the field let go of it. Running its label again once shown
  // calls `onCreate` again.
  useEffect(
    () => () => {
      for (const request of requests.current.values()) request.controller.abort();
      cancel();
    },
    [cancel],
  );

  const isPending = useCallback((label: string) => live.has(keyOf(label)), [live]);

  return { creating: live.size > 0, isPending, error, run, cancel, clearError };
}

function isThenable(result: CreateResult | undefined): result is Promise<string | void> {
  return result != null && typeof result === 'object' && 'then' in result;
}
