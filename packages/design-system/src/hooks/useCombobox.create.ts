import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import type { ComboboxFieldState } from './useCombobox.state.js';

type CreateResult = string | void | Promise<string | void>;

/** An async create in flight, the single value when it started, and whether it was dropped. */
type CreateRequest = { label: string; startValue: string | null; dropped: boolean };

const NONE: ReadonlyMap<string, CreateRequest> = new Map();

/** Whether the text asks for `label`: trimmed and case-insensitive, as the create row matches. */
export function readsLabel(text: string, label: string): boolean {
  return text.trim().toLowerCase() === label.trim().toLowerCase();
}

const keyOf = (label: string) => label.trim().toLowerCase();

/**
 * Whether a request still speaks for the field. In multiple mode it always does,
 * and its chip is added whatever the user did since. In single mode it does only
 * while the text reads its label and the value is the one it started from.
 */
function holds(request: CreateRequest, text: string, single: string | null, multiple: boolean): boolean {
  return multiple || (readsLabel(text, request.label) && Object.is(single, request.startValue));
}

/**
 * The async creates in flight, one per label, and the last one's failure. A request
 * stays in flight, blocking its label and counting in `creating`, until its promise
 * settles. One that stops holding, or that `cancel` drops, is dropped for good: it
 * settles without committing or reporting.
 */
export function useComboboxCreate(
  multiple: boolean,
  inputValue: string,
  single: string | null,
  state: RefObject<ComboboxFieldState>,
) {
  const requests = useRef(new Map<string, CreateRequest>());
  const [pending, setPending] = useState(NONE);
  const [error, setError] = useState<unknown | null>(null);
  // Any change to the text, the hook's or a controlled owner's, clears the last failure.
  const [errorText, setErrorText] = useState(inputValue);
  if (errorText !== inputValue) {
    setErrorText(inputValue);
    setError(null);
  }

  const sync = useCallback(() => {
    setPending(requests.current.size === 0 ? NONE : new Map(requests.current));
  }, []);

  useLayoutEffect(() => {
    for (const request of requests.current.values()) {
      if (!holds(request, inputValue, single, multiple)) request.dropped = true;
    }
  }, [inputValue, multiple, single]);

  /**
   * Runs `start` unless a create for `label` is pending, and hands its result to
   * `commit`. A throw from `start`, or its rejection, is the create's failure; a
   * throw from `commit` is the caller's.
   */
  const run = useCallback(
    (label: string, start: () => CreateResult | undefined, commit: (canonical: string | void) => void) => {
      const key = keyOf(label);
      const now = () => state.current;
      if (requests.current.has(key)) return;
      setError(null);
      let result: CreateResult | undefined;
      try {
        result = start();
      } catch (reason) {
        setError(reason);
        return;
      }
      if (!isThenable(result)) {
        commit(result);
        return;
      }
      const request: CreateRequest = { label, startValue: now().single, dropped: false };
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
          flushSync(() => {
            if (settle()) commit(canonical);
          });
        },
        (reason: unknown) => {
          // Reported only while the text still asks for this label.
          if (settle() && readsLabel(now().inputValue, label)) setError(reason);
        },
      );
    },
    [multiple, state, sync],
  );

  const cancel = useCallback(() => {
    for (const request of requests.current.values()) request.dropped = true;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Unmounting, or an Activity hiding the field, drops every request.
  useEffect(() => {
    const current = requests.current;
    return () => {
      current.clear();
      setPending(NONE);
    };
  }, []);

  const isPending = useCallback((label: string) => pending.has(keyOf(label)), [pending]);

  return { creating: pending.size > 0, isPending, error, run, cancel, clearError };
}

function isThenable(result: CreateResult | undefined): result is Promise<string | void> {
  return result != null && typeof result === 'object' && 'then' in result;
}
