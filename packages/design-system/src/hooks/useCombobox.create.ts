import { useCallback, useEffect, useRef, useState } from 'react';

type CreateResult = string | void | Promise<string | void>;

const NONE: ReadonlySet<string> = new Set();

function isThenable(result: CreateResult | undefined): result is Promise<string | void> {
  return result != null && typeof result === 'object' && 'then' in result;
}

/**
 * The async creates in flight, one per label. A request commits only while it
 * is still its label's entry, so `cancel` drops every request at once.
 */
export function useComboboxCreate() {
  const requests = useRef(new Map<string, object>());
  const [pending, setPending] = useState<ReadonlySet<string>>(NONE);
  const [error, setError] = useState<unknown | null>(null);

  const sync = useCallback(() => {
    setPending(requests.current.size === 0 ? NONE : new Set(requests.current.keys()));
  }, []);

  /** Runs `start` unless a create for `label` is pending, and hands its result to `commit`. */
  const run = useCallback(
    (label: string, start: () => CreateResult | undefined, commit: (canonical: string | void) => void) => {
      if (requests.current.has(label)) return;
      setError(null);
      const result = start();
      if (!isThenable(result)) {
        commit(result);
        return;
      }
      const request = {};
      const isCurrent = () => requests.current.get(label) === request;
      requests.current.set(label, request);
      sync();
      void Promise.resolve(result)
        .then((canonical) => {
          if (isCurrent()) commit(canonical);
        })
        .catch((reason: unknown) => {
          if (isCurrent()) setError(reason);
        })
        .finally(() => {
          if (!isCurrent()) return;
          requests.current.delete(label);
          sync();
        });
    },
    [sync],
  );

  const cancel = useCallback(() => {
    if (requests.current.size === 0) return;
    requests.current.clear();
    sync();
  }, [sync]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const current = requests.current;
    return () => current.clear();
  }, []);

  return { pending, error, run, cancel, clearError };
}
