import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { useDomId } from '../components/domId';
import { optionDomId } from '../components/OptionList.ids';
import type { BottomSheetRootProps } from '../components/BottomSheet';
import type { ButtonRootProps } from '../components/Button';
import type { DialogRootProps } from '../components/Dialog';
import type { FieldChipInputProps, FieldRootProps, FieldTextInputProps } from '../components/Field';
import type {
  OptionListMultipleProps,
  OptionListSingleProps,
  OptionListOptionProps,
} from '../components/OptionList';
import type { PopoverWire } from '../components/Popover.wire';
import { useStrings } from '../providers/StringsProvider';
import { createAsyncGate } from './useCombobox.async';
import { usePopoverInternal } from './usePopover';
import { defaultFilter, filterOptions } from './useCombobox.filter';
import type {
  ComboboxCloseReason,
  ComboboxItem,
  ComboboxOption,
} from './useCombobox.types';
import { useControlledState } from './useControlledState';
import {
  useSheetPresentation,
  type SheetPresentation,
} from './useSheetPresentation';

export type {
  ComboboxCloseReason,
  ComboboxItem,
  ComboboxOption,
} from './useCombobox.types';

const CREATE_VALUE = '__create__';

type BaseOptions = {
  options?: readonly ComboboxOption[];
  loadOptions?: (query: string, signal: AbortSignal) => Promise<readonly ComboboxOption[]>;
  /** Reload when this changes. `loadOptions` is read at call time, so changes to it alone do not reload. */
  loadKey?: string | number;
  filter?: (option: ComboboxOption, query: string) => boolean;
  presentation?: 'popover' | 'sheet' | 'dialog' | 'auto';
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: ComboboxCloseReason) => void;
  inputValue?: string;
  defaultInputValue?: string;
  onInputValueChange?: (value: string) => void;
  allowCreate?: boolean;
  onCreate?: (label: string) => string | void | Promise<string | void>;
  createLabel?: (query: string) => string;
  disabled?: boolean;
  id?: string;
};

export type UseComboboxSingleOptions = BaseOptions & {
  selectionMode?: 'single';
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
};

export type UseComboboxMultipleOptions = BaseOptions & {
  selectionMode: 'multiple';
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: string[]) => void;
};

export type UseComboboxOptions = UseComboboxSingleOptions | UseComboboxMultipleOptions;

export type UseComboboxResult = {
  selectionMode: 'single' | 'multiple';
  presentation: SheetPresentation | 'dialog';
  isSheet: boolean;
  open: boolean;
  inputValue: string;
  /** The trimmed input text. Empty while the input shows the committed label, when the list is unfiltered. */
  query: string;
  value: string | null | string[];
  items: ComboboxItem[];
  isEmpty: boolean;
  showCreate: boolean;
  activeId: string | null;
  activeValue: string | null;
  loading: boolean;
  error: unknown | null;
  retry: () => void;
  ids: { input: string; listbox: string; trigger: string };
  inputRef: RefObject<HTMLInputElement | null>;
  anchorRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  setOpen: (open: boolean, reason?: ComboboxCloseReason) => void;
  setInputValue: (value: string) => void;
  highlight: (value: string | null) => void;
  select: (value: string) => void;
  remove: (value: string) => void;
  clear: () => void;
  create: () => void;
  reset: () => void;
  getTriggerProps: () => ButtonRootProps & { ref: RefObject<HTMLButtonElement | null> };
  getAnchorProps: () => Pick<FieldRootProps, 'id' | 'style' | 'disabled'> & {
    ref: RefObject<HTMLDivElement | null>;
  };
  getInputProps: () => FieldTextInputProps & { ref: RefObject<HTMLInputElement | null> };
  getChipInputProps: () => FieldChipInputProps & { ref: RefObject<HTMLInputElement | null> };
  getPopoverProps: () => PopoverWire;
  getSheetProps: () => ComboboxSheetProps;
  getDialogProps: () => ComboboxDialogProps;
  getListboxProps: () => Omit<OptionListSingleProps, 'children'> | Omit<OptionListMultipleProps, 'children'>;
  getOptionProps: (item: ComboboxItem) => OptionListOptionProps;
};

/** The hook always sets open and onOpenChange, so they are required here. */
type ComboboxSheetProps = Pick<BottomSheetRootProps, 'initialFocusRef' | 'restoreFocusRef' | 'aria-label'> &
  Required<Pick<BottomSheetRootProps, 'open' | 'onOpenChange'>>;

type ComboboxDialogProps = Pick<DialogRootProps, 'initialFocusRef' | 'restoreFocusRef' | 'aria-label'> &
  Required<Pick<DialogRootProps, 'open' | 'onOpenChange'>>;

function isMultiple(options: UseComboboxOptions): options is UseComboboxMultipleOptions {
  return options.selectionMode === 'multiple';
}

const EMPTY_OPTIONS: readonly ComboboxOption[] = [];

function labelOf(
  options: readonly ComboboxOption[],
  value: string,
  cache?: ReadonlyMap<string, string>,
): string {
  return options.find((option) => option.value === value)?.label ?? cache?.get(value) ?? value;
}

export function useCombobox(options: UseComboboxOptions = {}): UseComboboxResult {
  const selectionMode = isMultiple(options) ? 'multiple' : 'single';
  const filter = options.filter ?? defaultFilter;
  const strings = useStrings();
  const createLabel = options.createLabel ?? strings.createOption;
  const autoId = useDomId();
  const uid = options.id?.replaceAll(':', '') ?? autoId;
  const ids = {
    input: `todae-cb-input-${uid}`,
    listbox: `todae-cb-list-${uid}`,
    trigger: `todae-cb-trigger-${uid}`,
  };

  const forced = options.presentation ?? 'auto';
  // A dialog never turns into a sheet.
  const sheet = useSheetPresentation({ forced: forced === 'dialog' ? 'popover' : forced });
  const presentation = forced === 'auto' ? sheet.presentation : forced;
  const isSheet = presentation === 'sheet';
  const isDialog = presentation === 'dialog';
  // The sheet and the dialog are modal: the input lives inside them, and it closes them on Escape.
  const isModal = isSheet || isDialog;

  const [open, setOpenState] = useControlledState(options.open, options.defaultOpen ?? false);
  const initialSingle = isMultiple(options)
    ? null
    : options.value !== undefined
      ? options.value
      : (options.defaultValue ?? null);
  // Only a label we actually know: never seed the input (and the first async query) with a raw id.
  const selectedLabel =
    options.options?.find((option) => option.value === initialSingle)?.label ?? '';
  const [inputValue, setInputState] = useControlledState(
    options.inputValue,
    options.defaultInputValue ?? selectedLabel,
  );
  const [singleValue, setSingleState] = useControlledState(
    isMultiple(options) ? undefined : options.value,
    isMultiple(options) ? null : (options.defaultValue ?? null),
  );
  const [multiValue, setMultiState] = useControlledState(
    isMultiple(options) ? options.value : undefined,
    isMultiple(options) ? (options.defaultValue ?? []) : [],
  );

  const value = selectionMode === 'multiple' ? [...multiValue] : singleValue;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // Filled only when nothing had focus at open (Safari does not focus a clicked button).
  // Left null, Dialog returns focus to whatever had it when the dialog opened.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [asyncOptions, setAsyncOptions] = useState<readonly ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const gate = useRef(createAsyncGate());
  const lastQuery = useRef(inputValue);
  // The query and loadKey of the last load, once it settles; null while a load is in flight.
  const [loadedFor, setLoadedFor] = useState<{ query: string; key: string | number | undefined } | null>(null);
  // Bumped by reset() to load again when the query and loadKey stay the same.
  const [reloads, setReloads] = useState(0);
  const lastPresentation = useRef(presentation);

  // Callbacks read the latest options through this ref so their identity stays stable and
  // inline `loadOptions` / `onValueChange` / `filter` functions never retrigger effects.
  const latest = useRef(options);
  latest.current = options;
  const hasLoader = Boolean(options.loadOptions);

  const source = hasLoader ? asyncOptions : (options.options ?? EMPTY_OPTIONS);
  // Async result sets replace each other as the query changes; remember labels so selected
  // chips and the committed input text do not fall back to raw values.
  const labels = useRef(new Map<string, string>());
  for (const option of source) labels.current.set(option.value, option.label);
  const labelFor = useCallback(
    (raw: string) => labelOf(source, raw, labels.current),
    [source],
  );
  const committedLabel =
    selectionMode === 'single' && singleValue ? labelFor(singleValue) : '';
  const filterQuery =
    selectionMode === 'single' && committedLabel !== '' && inputValue === committedLabel
      ? ''
      : inputValue;
  const filtered = useMemo(
    () => filterOptions(source, filterQuery, filter),
    [filter, filterQuery, source],
  );
  const trimmed = inputValue.trim();
  // False while the loaded list is still another query's or another loadKey's.
  const listIsCurrent =
    !hasLoader ||
    (loadedFor !== null && loadedFor.query === inputValue && Object.is(loadedFor.key, options.loadKey));
  // Whether the query matches a row is known only once its own list is in.
  const showCreate = Boolean(
    listIsCurrent &&
      options.allowCreate &&
      trimmed &&
      !filtered.some((option) => option.label.toLowerCase() === trimmed.toLowerCase()),
  );
  // The label text, not the function, keys the rows, so an inline createLabel
  // does not rebuild them on every render.
  const createRowLabel = showCreate ? createLabel(trimmed) : null;
  const items = useMemo<ComboboxItem[]>(() => {
    const rows: ComboboxItem[] = filtered.map((option) => ({
      kind: 'option',
      option,
      id: optionDomId(ids.listbox, option.value),
    }));
    if (createRowLabel !== null) {
      rows.push({
        kind: 'create',
        label: createRowLabel,
        value: trimmed,
        id: optionDomId(ids.listbox, CREATE_VALUE),
      });
    }
    return rows;
  }, [createRowLabel, filtered, ids.listbox, trimmed]);

  const enabledValues = useMemo(
    () =>
      items
        .filter((item) => item.kind === 'create' || !item.option.disabled)
        .map((item) => (item.kind === 'create' ? CREATE_VALUE : item.option.value)),
    [items],
  );
  const resolvedActive =
    activeValue && enabledValues.includes(activeValue)
      ? activeValue
      : listIsCurrent ? (enabledValues[0] ?? null) : null;
  const activeId = resolvedActive ? optionDomId(ids.listbox, resolvedActive) : null;
  const isEmpty = items.length === 0 && !loading && error == null;

  const setInputValue = useCallback(
    (next: string) => {
      setInputState(next);
      latest.current.onInputValueChange?.(next);
    },
    [setInputState],
  );

  const setOpen = useCallback(
    (next: boolean, reason: ComboboxCloseReason = 'trigger') => {
      // Each time the dialog opens, start from the full list with the top row active.
      // Reopened while still closing, focus is still inside: keep the query and the focus target.
      if (next && isDialog && !open && !inputRef.current?.closest('dialog')?.contains(document.activeElement)) {
        setInputValue('');
        setActiveValue(null);
        returnFocusRef.current = document.activeElement === document.body ? triggerRef.current : null;
      }
      setOpenState(next);
      latest.current.onOpenChange?.(next, reason);
    },
    [isDialog, open, setInputValue, setOpenState],
  );

  const highlight = useCallback((next: string | null) => {
    setActiveValue(next);
  }, []);

  const applySingle = useCallback(
    (next: string | null) => {
      setSingleState(next);
      const current = latest.current;
      if (!isMultiple(current)) current.onValueChange?.(next);
    },
    [setSingleState],
  );

  const applyMulti = useCallback(
    (next: string[]) => {
      setMultiState(next);
      const current = latest.current;
      if (isMultiple(current)) current.onValueChange?.(next);
    },
    [setMultiState],
  );

  const create = useCallback(() => {
    // A closing dialog stays live, so a second Enter or click would run it again.
    if (!showCreate || (isDialog && !open)) return;
    const label = trimmed;
    const commit = (canonical: string | void) => {
      const next = canonical ?? label;
      if (selectionMode === 'multiple') {
        const current = [...multiValue];
        applyMulti(current.includes(next) ? current : [...current, next]);
        setInputValue('');
        return;
      }
      applySingle(next);
      setInputValue(label);
      setOpen(false, 'select');
    };
    const pending = latest.current.onCreate?.(label);
    if (pending != null && typeof pending === 'object' && 'then' in pending) {
      void Promise.resolve(pending).then(commit);
      return;
    }
    commit(pending);
  }, [
    applyMulti,
    applySingle,
    isDialog,
    multiValue,
    open,
    selectionMode,
    setInputValue,
    setOpen,
    showCreate,
    trimmed,
  ]);

  const select = useCallback(
    (raw: string) => {
      if (raw === CREATE_VALUE) {
        create();
        return;
      }
      if (isDialog && !open) return;
      if (selectionMode === 'multiple') {
        const current = [...multiValue];
        const next = current.includes(raw) ? current.filter((item) => item !== raw) : [...current, raw];
        applyMulti(next);
        setInputValue('');
        return;
      }
      applySingle(raw);
      setInputValue(labelFor(raw));
      setOpen(false, 'select');
    },
    [applyMulti, applySingle, create, isDialog, labelFor, multiValue, open, selectionMode, setInputValue, setOpen],
  );

  const remove = useCallback(
    (raw: string) => {
      if (selectionMode !== 'multiple') {
        if (singleValue === raw) {
          applySingle(null);
          setInputValue('');
        }
        return;
      }
      applyMulti(multiValue.filter((item) => item !== raw));
    },
    [applyMulti, applySingle, multiValue, selectionMode, setInputValue, singleValue],
  );

  const clear = useCallback(() => {
    if (selectionMode === 'multiple') applyMulti([]);
    else applySingle(null);
    setInputValue('');
    setOpen(false, 'input-clear');
  }, [applyMulti, applySingle, selectionMode, setInputValue, setOpen]);

  const reset = useCallback(() => {
    const initial = latest.current;
    setOpenState(initial.defaultOpen ?? false);
    if (isMultiple(initial)) {
      setInputState(initial.defaultInputValue ?? '');
      setMultiState(initial.defaultValue ?? []);
    } else {
      const defaultValue = initial.defaultValue ?? null;
      setInputState(
        initial.defaultInputValue ??
          (defaultValue
            ? (initial.options ?? EMPTY_OPTIONS).find((option) => option.value === defaultValue)?.label ?? ''
            : ''),
      );
      setSingleState(defaultValue);
    }
    setActiveValue(null);
    setAsyncOptions([]);
    setLoadedFor(null);
    setError(null);
    setReloads((count) => count + 1);
  }, [setInputState, setMultiState, setOpenState, setSingleState]);

  const runLoad = useCallback(
    (query: string) => {
      const load = latest.current.loadOptions;
      if (!load) return;
      const key = latest.current.loadKey;
      lastQuery.current = query;
      setLoadedFor(null);
      setLoading(true);
      setError(null);
      void gate.current.next(query, load).then((result) => {
        if (!gate.current.isCurrent(result.gen)) return;
        if ('aborted' in result && result.aborted) return;
        setLoading(false);
        // A failed load still settles this query: no rows, so the create row
        // can show and no other query's rows stay active.
        if ('error' in result) setError(result.error);
        setAsyncOptions('error' in result ? [] : result.result);
        setLoadedFor({ query, key });
      });
    },
    [],
  );

  const retry = useCallback(() => {
    runLoad(lastQuery.current);
  }, [runLoad]);

  useEffect(() => {
    if (!hasLoader) return;
    runLoad(inputValue);
  }, [hasLoader, inputValue, options.loadKey, reloads, runLoad]);

  useEffect(() => {
    const current = gate.current;
    return () => current.abort();
  }, []);

  useEffect(() => {
    if (lastPresentation.current === presentation) return;
    lastPresentation.current = presentation;
    if (open) setOpen(false, 'blur');
  }, [open, presentation, setOpen]);

  useEffect(() => {
    if (!open) return;
    if (selectionMode === 'single' && singleValue && enabledValues.includes(singleValue)) {
      setActiveValue(singleValue);
      return;
    }
    setActiveValue((current) => {
      if (current && enabledValues.includes(current)) return current;
      // Pick a row only from this input's own list, once it is in.
      if (!listIsCurrent) return null;
      return enabledValues[0] ?? null;
    });
  }, [enabledValues, listIsCurrent, open, selectionMode, singleValue]);

  const move = useCallback(
    (delta: number | 'home' | 'end') => {
      if (enabledValues.length === 0) return;
      if (delta === 'home') {
        setActiveValue(enabledValues[0] ?? null);
        return;
      }
      if (delta === 'end') {
        setActiveValue(enabledValues[enabledValues.length - 1] ?? null);
        return;
      }
      const index = resolvedActive ? enabledValues.indexOf(resolvedActive) : -1;
      const next = Math.min(Math.max(index + delta, 0), enabledValues.length - 1);
      setActiveValue(enabledValues[next] ?? null);
    },
    [enabledValues, resolvedActive],
  );

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (latest.current.disabled) return;
      if (event.nativeEvent.isComposing || event.key === 'Process') return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        if (!open) {
          setOpen(true, 'trigger');
          if (event.key === 'ArrowUp' || event.key === 'End') move('end');
          else if (event.key === 'Home') move('home');
          return;
        }
        if (event.key === 'Home') move('home');
        else if (event.key === 'End') move('end');
        else move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        // While the list is another query's, Enter with no active row runs nothing:
        // showCreate is false until that list is in.
        if (resolvedActive === CREATE_VALUE || (showCreate && !resolvedActive)) create();
        else if (resolvedActive) select(resolvedActive);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (open) {
          if (isModal) setOpen(false, 'escape');
          return;
        }
        if (selectionMode === 'single' && !singleValue) setInputValue('');
        return;
      }
      if (event.key === 'Tab') {
        if (open) setOpen(false, 'blur');
      }
    },
    [
      create,
      isModal,
      move,
      open,
      resolvedActive,
      select,
      selectionMode,
      setInputValue,
      setOpen,
      showCreate,
      singleValue,
    ],
  );

  const changeInput = useCallback(
    (next: string) => {
      setInputValue(next);
      if (!open) setOpen(true, 'trigger');
      if (selectionMode === 'single' && next === '') applySingle(null);
    },
    [applySingle, open, selectionMode, setInputValue, setOpen],
  );

  const onInputFocus = useCallback(() => {
    if (isModal || options.disabled) return;
    if (!open) setOpen(true, 'trigger');
  }, [isModal, open, options.disabled, setOpen]);

  const onInputBlur = useCallback(
    (event: { relatedTarget: EventTarget | null }) => {
      if (isModal || options.disabled) return;
      const next = event.relatedTarget;
      if (!(next instanceof Node)) return;
      if (anchorRef.current?.contains(next)) return;
      if (document.getElementById(ids.listbox)?.contains(next)) return;
      if (open) setOpen(false, 'blur');
    },
    [ids.listbox, isModal, open, options.disabled, setOpen],
  );

  const comboboxAria = useMemo(
    () => ({
      role: 'combobox' as const,
      'aria-expanded': open,
      'aria-controls': ids.listbox,
      'aria-activedescendant': open ? activeId ?? undefined : undefined,
      'aria-autocomplete': 'list' as const,
      autoComplete: 'off',
      id: ids.input,
      disabled: options.disabled,
    }),
    [activeId, ids.input, ids.listbox, open, options.disabled],
  );

  const getTriggerProps = useCallback((): ButtonRootProps & {
    ref: RefObject<HTMLButtonElement | null>;
  } => {
    if (process.env.NODE_ENV !== 'production' && !isModal) {
      console.warn(
        'useCombobox: getTriggerProps is for sheet or dialog Button.Root. Popover mode uses getAnchorProps on Field.Root. Do not spread usePopover getTriggerProps.',
      );
    }
    return {
      id: ids.trigger,
      ref: triggerRef,
      disabled: options.disabled,
      'aria-haspopup': 'dialog',
      'aria-expanded': open,
      'aria-controls': ids.listbox,
      onClick: () => setOpen(!open, 'trigger'),
    };
  }, [ids.listbox, ids.trigger, isModal, open, options.disabled, setOpen]);

  const getAnchorProps = useCallback(
    (): Pick<FieldRootProps, 'id' | 'style' | 'disabled'> & {
      ref: RefObject<HTMLDivElement | null>;
    } => ({
      id: ids.input,
      disabled: options.disabled,
      ref: anchorRef,
    }),
    [ids.input, options.disabled],
  );

  const getInputProps = useCallback(
    (): FieldTextInputProps & { ref: RefObject<HTMLInputElement | null> } => ({
      ...comboboxAria,
      ref: inputRef,
      value: inputValue,
      onChange: (event: ChangeEvent<HTMLInputElement>) => changeInput(event.target.value),
      onKeyDown: onInputKeyDown,
      onFocus: onInputFocus,
      onBlur: onInputBlur,
    }),
    [changeInput, comboboxAria, inputValue, onInputBlur, onInputFocus, onInputKeyDown],
  );

  const getChipInputProps = useCallback(
    (): FieldChipInputProps & { ref: RefObject<HTMLInputElement | null> } => {
      const selected = selectionMode === 'multiple' ? [...multiValue] : [];
      return {
        ...comboboxAria,
        ref: inputRef,
        chips: selected.map(labelFor),
        inputValue,
        onInputValueChange: changeInput,
        onCommit: () => {
          if (resolvedActive === CREATE_VALUE) create();
          else if (resolvedActive) select(resolvedActive);
          else if (showCreate) create();
        },
        onChipRemove: (index) => {
          const item = selected[index];
          if (item) remove(item);
        },
        commitKeys: ['Enter'],
        onKeyDown: onInputKeyDown,
        onFocus: onInputFocus,
        onBlur: onInputBlur,
      };
    },
    [
      changeInput,
      comboboxAria,
      create,
      inputValue,
      multiValue,
      onInputBlur,
      onInputFocus,
      onInputKeyDown,
      remove,
      resolvedActive,
      select,
      selectionMode,
      showCreate,
      labelFor,
    ],
  );

  const popover = usePopoverInternal(
    {
      open,
      onOpenChange: setOpen,
      anchorRef,
      initialFocusRef: inputRef,
      restoreFocusRef: inputRef,
      enabled: !isModal,
    },
    false,
  );

  const optionsName = strings.options;
  const getSheetProps = useCallback(
    (): ComboboxSheetProps => ({
      open,
      onOpenChange: (next, reason) => setOpen(next, reason),
      initialFocusRef: inputRef,
      restoreFocusRef: triggerRef,
      'aria-label': optionsName,
    }),
    [open, setOpen, optionsName],
  );

  const getDialogProps = useCallback(
    (): ComboboxDialogProps => ({
      open,
      onOpenChange: (next, reason) => setOpen(next, reason),
      initialFocusRef: inputRef,
      restoreFocusRef: returnFocusRef,
      'aria-label': 'Options',
    }),
    [open, setOpen],
  );

  const getListboxProps = useCallback(():
    | Omit<OptionListSingleProps, 'children'>
    | Omit<OptionListMultipleProps, 'children'> => {
    if (selectionMode === 'multiple') {
      return {
        id: ids.listbox,
        selectionMode: 'multiple',
        value: [...multiValue],
        onValueChange: (next: string[]) => {
          const added = next.find((item) => !multiValue.includes(item));
          const removed = multiValue.find((item) => !next.includes(item));
          const raw = added ?? removed;
          if (raw) select(raw);
        },
        activeValue: resolvedActive,
        onActiveValueChange: highlight,
        tabIndex: -1,
        'aria-labelledby': ids.input,
      };
    }
    return {
      id: ids.listbox,
      selectionMode: 'single',
      value: singleValue,
      onValueChange: (next: string) => select(next),
      activeValue: resolvedActive,
      onActiveValueChange: highlight,
      tabIndex: -1,
      'aria-labelledby': ids.input,
    };
  }, [highlight, ids.input, ids.listbox, multiValue, resolvedActive, select, selectionMode, singleValue]);

  const getOptionProps = useCallback((item: ComboboxItem): OptionListOptionProps => {
    if (item.kind === 'create') {
      return { value: CREATE_VALUE, children: item.label };
    }
    return {
      value: item.option.value,
      children: item.option.label,
      disabled: item.option.disabled,
    };
  }, []);

  return {
    selectionMode,
    presentation,
    isSheet,
    open,
    inputValue,
    query: filterQuery.trim(),
    value,
    items,
    isEmpty,
    showCreate,
    activeId,
    activeValue: resolvedActive,
    loading,
    error,
    retry,
    ids,
    inputRef,
    anchorRef,
    triggerRef,
    setOpen,
    setInputValue,
    highlight,
    select,
    remove,
    clear,
    create,
    reset,
    getTriggerProps,
    getAnchorProps,
    getInputProps,
    getChipInputProps,
    getPopoverProps: popover.getPopoverProps,
    getSheetProps,
    getDialogProps,
    getListboxProps,
    getOptionProps,
  };
}
