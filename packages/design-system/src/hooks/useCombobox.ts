import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { optionDomId } from '../components/OptionList.ids';
import type { BottomSheetProps } from '../components/BottomSheet';
import type { ButtonRootProps } from '../components/Button';
import type { FieldChipInputProps, FieldRootProps, FieldTextInputProps } from '../components/Field';
import type {
  OptionListMultipleProps,
  OptionListSingleProps,
  OptionProps,
} from '../components/OptionList';
import type { PopoverWire } from '../components/Popover.wire';
import { createAsyncGate } from './useCombobox.async';
import { usePopover } from './usePopover';
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
  filter?: (option: ComboboxOption, query: string) => boolean;
  presentation?: 'popover' | 'sheet' | 'auto';
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
  onChange?: (value: string | null) => void;
};

export type UseComboboxMultipleOptions = BaseOptions & {
  selectionMode: 'multiple';
  value?: readonly string[];
  defaultValue?: readonly string[];
  onChange?: (value: string[]) => void;
};

export type UseComboboxOptions = UseComboboxSingleOptions | UseComboboxMultipleOptions;

export type UseComboboxResult = {
  selectionMode: 'single' | 'multiple';
  presentation: SheetPresentation;
  isSheet: boolean;
  open: boolean;
  inputValue: string;
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
  getSheetProps: () => Pick<
    BottomSheetProps,
    'open' | 'onOpenChange' | 'initialFocusRef' | 'restoreFocusRef' | 'aria-label'
  >;
  getListboxProps: () => Omit<OptionListSingleProps, 'children'> | Omit<OptionListMultipleProps, 'children'>;
  getOptionProps: (item: ComboboxItem) => OptionProps;
};

function isMultiple(options: UseComboboxOptions): options is UseComboboxMultipleOptions {
  return options.selectionMode === 'multiple';
}

function labelOf(options: readonly ComboboxOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function useCombobox(options: UseComboboxOptions = {}): UseComboboxResult {
  const selectionMode = isMultiple(options) ? 'multiple' : 'single';
  const filter = options.filter ?? defaultFilter;
  const createLabel = options.createLabel ?? ((query: string) => `Create "${query}"`);
  const autoId = useId();
  const uid = (options.id ?? autoId).replaceAll(':', '');
  const ids = {
    input: `todae-cb-input-${uid}`,
    listbox: `todae-cb-list-${uid}`,
    trigger: `todae-cb-trigger-${uid}`,
  };

  const sheet = useSheetPresentation({
    forced: options.presentation && options.presentation !== 'auto' ? options.presentation : 'auto',
  });
  const presentation = options.presentation === 'popover' || options.presentation === 'sheet'
    ? options.presentation
    : sheet.presentation;
  const isSheet = presentation === 'sheet';

  const [open, setOpenState] = useControlledState(options.open, options.defaultOpen ?? false);
  const selectedLabel =
    !isMultiple(options) && options.defaultValue
      ? labelOf(options.options ?? [], options.defaultValue)
      : '';
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
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [asyncOptions, setAsyncOptions] = useState<readonly ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const gate = useRef(createAsyncGate());
  const lastQuery = useRef(inputValue);
  const lastPresentation = useRef(presentation);

  const source = options.loadOptions ? asyncOptions : (options.options ?? []);
  const committedLabel =
    selectionMode === 'single' && singleValue ? labelOf(source, singleValue) : '';
  const filterQuery =
    selectionMode === 'single' && committedLabel !== '' && inputValue === committedLabel
      ? ''
      : inputValue;
  const filtered = useMemo(
    () => filterOptions(source, filterQuery, filter),
    [filter, filterQuery, source],
  );
  const trimmed = inputValue.trim();
  const showCreate = Boolean(
    options.allowCreate &&
      trimmed &&
      !filtered.some((option) => option.label.toLowerCase() === trimmed.toLowerCase()),
  );
  const items = useMemo<ComboboxItem[]>(() => {
    const rows: ComboboxItem[] = filtered.map((option) => ({
      kind: 'option',
      option,
      id: optionDomId(ids.listbox, option.value),
    }));
    if (showCreate) {
      rows.push({
        kind: 'create',
        label: createLabel(trimmed),
        value: trimmed,
        id: `${ids.listbox}-opt-${CREATE_VALUE}`,
      });
    }
    return rows;
  }, [createLabel, filtered, ids.listbox, showCreate, trimmed]);

  const enabledValues = useMemo(
    () =>
      items
        .filter((item) => item.kind === 'create' || !item.option.disabled)
        .map((item) => (item.kind === 'create' ? CREATE_VALUE : item.option.value)),
    [items],
  );
  const resolvedActive =
    activeValue && enabledValues.includes(activeValue) ? activeValue : (enabledValues[0] ?? null);
  const activeId = resolvedActive ? optionDomId(ids.listbox, resolvedActive) : null;
  const isEmpty = items.length === 0 && !loading;

  const setOpen = useCallback(
    (next: boolean, reason: ComboboxCloseReason = 'trigger') => {
      setOpenState(next);
      options.onOpenChange?.(next, reason);
    },
    [options, setOpenState],
  );

  const setInputValue = useCallback(
    (next: string) => {
      setInputState(next);
      options.onInputValueChange?.(next);
    },
    [options, setInputState],
  );

  const highlight = useCallback((next: string | null) => {
    setActiveValue(next);
  }, []);

  const applySingle = useCallback(
    (next: string | null) => {
      setSingleState(next);
      if (!isMultiple(options)) options.onChange?.(next);
    },
    [options, setSingleState],
  );

  const applyMulti = useCallback(
    (next: string[]) => {
      setMultiState(next);
      if (isMultiple(options)) options.onChange?.(next);
    },
    [options, setMultiState],
  );

  const create = useCallback(() => {
    if (!showCreate) return;
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
    const pending = options.onCreate?.(label);
    if (pending != null && typeof pending === 'object' && 'then' in pending) {
      void Promise.resolve(pending).then(commit);
      return;
    }
    commit(pending);
  }, [
    applyMulti,
    applySingle,
    multiValue,
    options,
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
      if (selectionMode === 'multiple') {
        const current = [...multiValue];
        const next = current.includes(raw) ? current.filter((item) => item !== raw) : [...current, raw];
        applyMulti(next);
        setInputValue('');
        return;
      }
      applySingle(raw);
      setInputValue(labelOf(source, raw));
      setOpen(false, 'select');
    },
    [applyMulti, applySingle, create, multiValue, selectionMode, setInputValue, setOpen, source],
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
    setOpenState(options.defaultOpen ?? false);
    setInputState(options.defaultInputValue ?? '');
    if (selectionMode === 'multiple') setMultiState(isMultiple(options) ? (options.defaultValue ?? []) : []);
    else setSingleState(isMultiple(options) ? null : (options.defaultValue ?? null));
    setActiveValue(null);
    setAsyncOptions([]);
    setError(null);
    setLoading(false);
  }, [options, selectionMode, setInputState, setMultiState, setOpenState, setSingleState]);

  const runLoad = useCallback(
    (query: string) => {
      if (!options.loadOptions) return;
      lastQuery.current = query;
      setLoading(true);
      setError(null);
      void gate.current.next(query, options.loadOptions).then((result) => {
        if (!gate.current.isCurrent(result.gen)) return;
        if ('aborted' in result && result.aborted) return;
        setLoading(false);
        if ('error' in result) {
          setError(result.error);
          return;
        }
        setAsyncOptions(result.result);
      });
    },
    [options.loadOptions],
  );

  const retry = useCallback(() => {
    runLoad(lastQuery.current);
  }, [runLoad]);

  useEffect(() => {
    if (!options.loadOptions) return;
    runLoad(inputValue);
  }, [inputValue, options.loadOptions, runLoad]);

  useEffect(() => {
    return () => gate.current.abort();
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
    setActiveValue((current) =>
      current && enabledValues.includes(current) ? current : (enabledValues[0] ?? null),
    );
  }, [enabledValues, open, selectionMode, singleValue]);

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
      if (options.disabled) return;
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
        if (resolvedActive === CREATE_VALUE || (showCreate && !resolvedActive)) create();
        else if (resolvedActive) select(resolvedActive);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (open) {
          if (isSheet) setOpen(false, 'escape');
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
      isSheet,
      move,
      open,
      options.disabled,
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
    if (isSheet || options.disabled) return;
    if (!open) setOpen(true, 'trigger');
  }, [isSheet, open, options.disabled, setOpen]);

  const onInputBlur = useCallback(
    (event: { relatedTarget: EventTarget | null }) => {
      if (isSheet || options.disabled) return;
      const next = event.relatedTarget;
      if (!(next instanceof Node)) return;
      if (anchorRef.current?.contains(next)) return;
      if (document.getElementById(ids.listbox)?.contains(next)) return;
      if (open) setOpen(false, 'blur');
    },
    [ids.listbox, isSheet, open, options.disabled, setOpen],
  );

  const comboboxAria = {
    role: 'combobox' as const,
    'aria-expanded': open,
    'aria-controls': ids.listbox,
    'aria-activedescendant': open ? activeId ?? undefined : undefined,
    'aria-autocomplete': 'list' as const,
    autoComplete: 'off',
    id: ids.input,
    disabled: options.disabled,
  };

  const getTriggerProps = useCallback((): ButtonRootProps & {
    ref: RefObject<HTMLButtonElement | null>;
  } => {
    if (process.env.NODE_ENV !== 'production' && !isSheet) {
      console.warn(
        'useCombobox: getTriggerProps is for sheet Button.Root. Popover mode uses getAnchorProps on Field.Root. Do not spread usePopover getTriggerProps.',
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
  }, [ids.listbox, ids.trigger, isSheet, open, options.disabled, setOpen]);

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
        chips: selected.map((item) => labelOf(source, item)),
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
      source,
    ],
  );

  const popover = usePopover({
    open,
    onOpenChange: setOpen,
    anchorRef,
    initialFocusRef: inputRef,
    restoreFocusRef: inputRef,
    enabled: !isSheet,
  });

  const getSheetProps = useCallback(
    (): Pick<
      BottomSheetProps,
      'open' | 'onOpenChange' | 'initialFocusRef' | 'restoreFocusRef' | 'aria-label'
    > => ({
      open,
      onOpenChange: (next, reason) => setOpen(next, reason),
      initialFocusRef: inputRef,
      restoreFocusRef: triggerRef,
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
        onChange: (next: string[]) => {
          const added = next.find((item) => !multiValue.includes(item));
          const removed = multiValue.find((item) => !next.includes(item));
          const raw = added ?? removed;
          if (raw) select(raw);
        },
        activeValue: resolvedActive,
        onActiveChange: highlight,
        tabIndex: -1,
        'aria-labelledby': ids.input,
      };
    }
    return {
      id: ids.listbox,
      selectionMode: 'single',
      value: singleValue,
      onChange: (next: string) => select(next),
      activeValue: resolvedActive,
      onActiveChange: highlight,
      tabIndex: -1,
      'aria-labelledby': ids.input,
    };
  }, [highlight, ids.input, ids.listbox, multiValue, resolvedActive, select, selectionMode, singleValue]);

  const getOptionProps = useCallback((item: ComboboxItem): OptionProps => {
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
    getListboxProps,
    getOptionProps,
  };
}
