import type { ComboboxOption } from './useCombobox.types';

export type AsyncLoad = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly ComboboxOption[]>;

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
      return load(query, signal).then(
        (result) => ({ gen, result, aborted: false as const }),
        (error: unknown) => ({ gen, error, aborted: signal.aborted }),
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
