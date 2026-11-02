import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OptionListOptionProps } from '../../components/OptionList.js';
import { optionDomId } from '../../internal/optionDomId.js';
import { defaultFilter, filterOptions } from './filter.js';
import { createAsyncGate, type AsyncLoad } from './load.js';
import type { ComboboxOption } from './types.js';

export type OptionListConfig = {
  /** The listbox's DOM id. Each row's id is built from it. */
  listboxId: string;
  /** Sync options. Ignored when `loadOptions` is set. */
  options?: readonly ComboboxOption[];
  /** Async options for `query`. Read at call time, so an inline function does not reload. */
  loadOptions?: AsyncLoad;
  /** Loads again when it changes, compared with `Object.is`. */
  loadKey?: string | number;
  /** The text the list is for, or null while no list is asked for: nothing loads then. */
  query: string | null;
  /** Filters sync options. Loaded options show as the loader returns them. */
  filter?: (option: ComboboxOption, query: string) => boolean;
  /**
   * Which list this is, when one hook shows several, as each mention trigger
   * word does. Loaded rows and the highlight belong to one scope and never
   * show in another.
   */
  scope?: string;
  /** Whether an enabled option can be picked now. A row that cannot is disabled. */
  canPick?: (option: ComboboxOption) => boolean;
  /**
   * The value of one row after the options, such as a create row, or null for
   * none. Asked only once the list is current, since only then is it known
   * what the options hold. The row is always enabled.
   */
  trailing?: (options: readonly ComboboxOption[]) => string | null;
  /** The row to make active when none is chosen, if it is enabled; else the first. */
  preferred?: string | null;
};

/** Where `move` sends the highlight: one row down or up, or to an end. */
export type OptionListMove = 1 | -1 | 'first' | 'last';

export type OptionList = {
  /** The options to show: the query's, or while its load is out, the last ones this scope loaded. */
  options: readonly ComboboxOption[];
  /** The trailing row's value, or null. */
  trailing: string | null;
  /** The values that can be active, in order, the trailing row last. */
  enabledValues: readonly string[];
  /** False while the options shown were loaded for another query, `loadKey` or run. */
  listIsCurrent: boolean;
  loading: boolean;
  /** The current load's failure, or null. */
  error: unknown | null;
  /** True once the current list is in and has no rows and no error. */
  isEmpty: boolean;
  /** Loads the current query again. */
  retry: () => void;
  /** Forgets loaded rows and the highlight, and loads again. */
  reset: () => void;
  activeValue: string | null;
  activeId: string | null;
  /** Chooses the active row, or with null goes back to the default one. */
  highlight: (value: string | null) => void;
  move: (to: OptionListMove) => void;
  /** The part of the listbox props every option list shares. */
  listboxProps: {
    id: string;
    activeValue: string | null;
    onActiveValueChange: (value: string | null) => void;
    tabIndex: -1;
  };
  getOptionProps: (option: ComboboxOption) => OptionListOptionProps;
};

/** The last settled load, and what it was for. */
type Loaded = {
  scope: string;
  query: string;
  key: string | number | undefined;
  run: number;
  options: readonly ComboboxOption[];
  error: unknown | null;
  /** True once a newer load is out, which may be for the same query. */
  pending: boolean;
};

const EMPTY: readonly ComboboxOption[] = [];

/**
 * The option-list engine `useCombobox` and `useMentions` share: sync or async
 * rows for a query, stale loads discarded, loading, error and retry, the
 * active row and the arrow keys. The consumer adds its own rows' meaning and
 * the keys that pick.
 */
export function useOptionList(config: OptionListConfig): OptionList {
  const { listboxId, query, loadKey, canPick, preferred = null } = config;
  const scope = config.scope ?? '';
  const filter = config.filter ?? defaultFilter;
  const hasLoader = Boolean(config.loadOptions);
  const [gate] = useState(createAsyncGate);
  // Bumped by retry and reset, so the same query loads again.
  const [run, setRun] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [active, setActive] = useState<{ scope: string; value: string } | null>(null);

  // The loader is read when a load starts, so an inline function loads once per query.
  const loader = useRef(config.loadOptions);
  loader.current = config.loadOptions;

  useEffect(() => {
    if (!hasLoader || query === null) return;
    const read = loader.current;
    if (!read) return;
    // The rows stay on show, but are no longer this query's answer.
    setLoaded((last) => (last === null || last.pending ? last : { ...last, pending: true }));
    void gate.next(query, read).then((result) => {
      if (!gate.isCurrent(result.gen)) return;
      if ('error' in result && result.aborted) return;
      // A failed load still settles its query, with no rows.
      setLoaded(
        'error' in result
          ? { scope, query, key: loadKey, run, options: EMPTY, error: result.error, pending: false }
          : { scope, query, key: loadKey, run, options: result.result, error: null, pending: false },
      );
    });
  }, [gate, hasLoader, loadKey, query, run, scope]);

  useEffect(() => () => gate.abort(), [gate]);

  const ownScope = loaded !== null && loaded.scope === scope ? loaded : null;
  const current =
    hasLoader &&
    query !== null &&
    ownScope !== null &&
    !ownScope.pending &&
    ownScope.query === query &&
    Object.is(ownScope.key, loadKey) &&
    ownScope.run === run
      ? ownScope
      : null;
  const listIsCurrent = !hasLoader || current !== null;
  const loading = hasLoader && query !== null && current === null;
  const error = current?.error ?? null;

  const source = hasLoader ? (ownScope?.options ?? EMPTY) : (config.options ?? EMPTY);
  const options = useMemo(
    () => (query === null ? EMPTY : hasLoader ? source : filterOptions(source, query, filter)),
    [filter, hasLoader, query, source],
  );
  const trailing = listIsCurrent && query !== null && config.trailing ? config.trailing(options) : null;
  const enabledValues = useMemo(() => {
    const values = options
      .filter((option) => !option.disabled && (!canPick || canPick(option)))
      .map((option) => option.value);
    if (trailing !== null) values.push(trailing);
    return values;
  }, [canPick, options, trailing]);

  // A highlight is forgotten once its row leaves the list, so it does not come back with it.
  const chosen = active !== null && active.scope === scope ? active.value : null;
  if (chosen !== null && !enabledValues.includes(chosen)) setActive(null);
  // Until this query's own list is in, no row is active unless one was chosen.
  const activeValue =
    chosen !== null && enabledValues.includes(chosen)
      ? chosen
      : !listIsCurrent
        ? null
        : preferred !== null && enabledValues.includes(preferred)
          ? preferred
          : (enabledValues[0] ?? null);
  const activeId = activeValue === null ? null : optionDomId(listboxId, activeValue);

  const highlight = useCallback(
    (value: string | null) => setActive(value === null ? null : { scope, value }),
    [scope],
  );

  // With no active row, down goes to the first row and up to the last, as the
  // ARIA combobox pattern has it. Otherwise the highlight stops at either end.
  const move = useCallback(
    (to: OptionListMove) => {
      const last = enabledValues.length - 1;
      if (last < 0) return;
      let index: number;
      if (to === 'first') index = 0;
      else if (to === 'last') index = last;
      else {
        const at = activeValue === null ? -1 : enabledValues.indexOf(activeValue);
        index = at === -1 ? (to > 0 ? 0 : last) : Math.min(Math.max(at + to, 0), last);
      }
      highlight(enabledValues[index] ?? null);
    },
    [activeValue, enabledValues, highlight],
  );

  const retry = useCallback(() => setRun((count) => count + 1), []);
  const reset = useCallback(() => {
    setLoaded(null);
    setActive(null);
    setRun((count) => count + 1);
  }, []);

  const listboxProps = useMemo(
    () => ({ id: listboxId, activeValue, onActiveValueChange: highlight, tabIndex: -1 as const }),
    [activeValue, highlight, listboxId],
  );

  const getOptionProps = useCallback(
    (option: ComboboxOption): OptionListOptionProps => ({
      value: option.value,
      children: option.label,
      disabled: option.disabled || (canPick !== undefined && !canPick(option)) || undefined,
    }),
    [canPick],
  );

  return {
    options,
    trailing,
    enabledValues,
    listIsCurrent,
    loading,
    error,
    isEmpty: listIsCurrent && query !== null && options.length === 0 && trailing === null && error == null,
    retry,
    reset,
    activeValue,
    activeId,
    highlight,
    move,
    listboxProps,
    getOptionProps,
  };
}
