import type { ComboboxOption } from './useCombobox.types.js';

export type AsyncLoad = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly ComboboxOption[]>;

/**
 * What a failure reads as: its reason, or an Error holding it as `cause` when
 * it is falsy, so `reject()`, `throw null` or `reject('')` still read as one.
 */
export function failureOf(reason: unknown): unknown {
  return reason || new Error('Failed without a reason', { cause: reason });
}

export function createAsyncGate() {
  let generation = 0;
  let controller: AbortController | null = null;

  return {
    next(query: string, load: AsyncLoad) {
      generation += 1;
      const gen = generation;
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      let loaded: Promise<readonly ComboboxOption[]>;
      // A load that throws before it returns a promise fails like one that rejects.
      try {
        loaded = load(query, signal);
      } catch (error) {
        loaded = Promise.reject(error);
      }
      return loaded.then(
        (result) => ({ gen, result, aborted: false as const }),
        (error: unknown) => ({ gen, error: failureOf(error), aborted: signal.aborted }),
      );
    },
    isCurrent(gen: number) {
      return gen === generation;
    },
    abort() {
      controller?.abort();
    },
  };
}
