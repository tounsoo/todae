import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AriaAttributes,
  type ChangeEvent,
  type KeyboardEvent,
  type RefCallback,
  type RefObject,
} from 'react';
import { useDomId } from '../internal/domId.js';
import { isImeKeyEvent } from '../internal/ime.js';
import { composeHandlers, useComposedRefs, useStableComposedRef } from '../internal/props.js';
import { optionDomId } from '../internal/optionDomId.js';
import type { BottomSheetRootProps } from '../components/BottomSheet.js';
import type { ButtonRootProps } from '../components/Button.js';
import type { DialogRootProps } from '../components/Dialog.js';
import type { FieldChipInputProps, FieldRootProps, FieldTextInputProps } from '../components/Field.js';
import type {
  OptionListMultipleProps,
  OptionListSingleProps,
  OptionListOptionProps,
} from '../components/OptionList.js';
import type { PopoverWire } from '../overlay/popoverWire.js';
import { useStrings } from '../providers/StringsProvider.js';
import { readsLabel, useComboboxCreate } from './useCombobox.create.js';
import { isMultiple, useComboboxState } from './useCombobox.state.js';
import { usePopoverInternal } from '../overlay/popover.js';
import { useOptionList } from './optionList/useOptionList.js';
import type {
  ComboboxCloseReason,
  ComboboxItem,
  ComboboxOption,
} from './useCombobox.types.js';
import {
  useSheetPresentation,
  type SheetPresentation,
} from './useSheetPresentation.js';

export type {
  ComboboxCloseReason,
  ComboboxItem,
  ComboboxOption,
} from './useCombobox.types.js';

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
  /**
   * Creates `label`'s option, and may return its value or a promise of it. `signal` aborts when
   * the field unmounts or an `Activity` hides it; a pick, `clear()` or `reset()` leaves it running.
   */
  onCreate?: (label: string, signal: AbortSignal) => string | void | Promise<string | void>;
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
  /**
   * The last load's failure, which `retry` loads again; an Error, with the reason as its `cause`,
   * when the reason was falsy.
   * A create's failure is in `createError`.
   */
  error: unknown | null;
  retry: () => void;
  /** True while an async `onCreate` is pending, until a pick, `clear()` or `reset()` drops it. */
  creating: boolean;
  /**
   * What `onCreate` last threw or rejected with, or an Error with it as `cause` when it was falsy,
   * kept only while the text still asks for that label.
   * Cleared by the next text change, pick, removal, clear, create or opening of the list. A throw
   * from a change callback is the caller's, not a create failure.
   */
  createError: unknown | null;
  /** `label` is for the field's Label, through `getLabelProps()`: the listbox takes its name from it. */
  ids: { input: string; label: string; listbox: string; trigger: string };
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
  /**
   * Merges the caller's props and ref; the hook's `id` and `aria-*` props win over the caller's.
   * Without the caller's `aria-label` or `aria-labelledby`, the trigger is named by the field's
   * Label and its own text; with no Label rendered, by its text alone. A click handler that calls
   * `preventDefault()` skips the toggle.
   * Pass a stable `ref`: an inline callback ref is attached again on every render.
   */
  getTriggerProps: (props?: ButtonRootProps) => ButtonRootProps & { ref: RefCallback<HTMLButtonElement> };
  getAnchorProps: () => Pick<FieldRootProps, 'id' | 'style' | 'disabled'> & {
    ref: RefObject<HTMLDivElement | null>;
  };
  getInputProps: () => FieldTextInputProps & { ref: RefObject<HTMLInputElement | null> };
  getChipInputProps: () => FieldChipInputProps & { ref: RefObject<HTMLInputElement | null> };
  getPopoverProps: () => PopoverWire;
  getSheetProps: () => ComboboxSheetProps;
  getDialogProps: () => ComboboxDialogProps;
  /** For the field's Label: its `id` names the listbox, and `htmlFor` is the trigger in a sheet or dialog, else the input. */
  getLabelProps: () => { id: string; htmlFor: string };
  /** Names the listbox by `ids.label`, unless you pass `aria-label` or `aria-labelledby`. */
  getListboxProps: (
    props?: ComboboxListboxNameProps,
  ) => Omit<OptionListSingleProps, 'children'> | Omit<OptionListMultipleProps, 'children'>;
  getOptionProps: (item: ComboboxItem) => OptionListOptionProps;
};

type ComboboxListboxNameProps = Pick<AriaAttributes, 'aria-label' | 'aria-labelledby'>;

/** The hook always sets open and onOpenChange, so they are required here. */
type ComboboxSheetProps = Pick<BottomSheetRootProps, 'initialFocusRef' | 'restoreFocusRef' | 'aria-label'> &
  Required<Pick<BottomSheetRootProps, 'open' | 'onOpenChange'>>;

type ComboboxDialogProps = Pick<DialogRootProps, 'initialFocusRef' | 'restoreFocusRef' | 'aria-label'> &
  Required<Pick<DialogRootProps, 'open' | 'onOpenChange'>>;

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
  const strings = useStrings();
  const createLabel = options.createLabel ?? strings.createOption;
  const autoId = useDomId();
  const uid = options.id?.replaceAll(':', '') ?? autoId;
  const ids = {
    input: `todae-cb-input-${uid}`,
    label: `todae-cb-label-${uid}`,
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

  // Callbacks read the latest options through this ref so their identity stays stable and
  // inline `loadOptions` / `onValueChange` / `filter` functions never retrigger effects.
  const latest = useRef(options);
  latest.current = options;
  const { open, inputValue, singleValue, multiValue, fieldNow, apply } = useComboboxState(options, latest);
  const value = selectionMode === 'multiple' ? [...multiValue] : singleValue;
  const {
    creating,
    isPending: isCreatePending,
    error: createError,
    run: runCreate,
    cancel: cancelCreates,
    clearError: clearCreateError,
  } = useComboboxCreate(selectionMode === 'multiple', inputValue, fieldNow);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // Filled only when nothing had focus at open (Safari does not focus a clicked button).
  // Left null, Dialog returns focus to whatever had it when the dialog opened.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const lastPresentation = useRef(presentation);

  // Async result sets replace each other as the query changes; remember labels so selected
  // chips and the committed input text do not fall back to raw values.
  const labels = useRef(new Map<string, string>());
  const syncOptions = options.loadOptions ? EMPTY_OPTIONS : (options.options ?? EMPTY_OPTIONS);
  const committedLabel =
    selectionMode === 'single' && singleValue ? labelOf(syncOptions, singleValue, labels.current) : '';
  // Empty while the input shows the committed label, so the list is the full one.
  const filterQuery =
    selectionMode === 'single' && committedLabel !== '' && inputValue === committedLabel
      ? ''
      : inputValue;
  const trimmed = inputValue.trim();
  const list = useOptionList({
    listboxId: ids.listbox,
    options: options.options,
    loadOptions: options.loadOptions,
    loadKey: options.loadKey,
    query: filterQuery,
    filter: options.filter,
    // Whether the query matches a row is known only once its own list is in.
    trailing: (shown) =>
      options.allowCreate &&
      trimmed &&
      !shown.some((option) => option.label.toLowerCase() === trimmed.toLowerCase())
        ? CREATE_VALUE
        : null,
    // On open, the selected single value is the active row.
    preferred: selectionMode === 'single' ? singleValue : null,
  });
  const { activeValue, activeId, listIsCurrent, highlight, move, reset: resetList, getOptionProps: optionProps } = list;
  for (const option of list.options) labels.current.set(option.value, option.label);
  const labelFor = useCallback(
    (raw: string) => labelOf(list.options, raw, labels.current),
    [list.options],
  );
  const showCreate = list.trailing !== null;
  // The label text, not the function, keys the rows, so an inline createLabel
  // does not rebuild them on every render.
  const createRowLabel = showCreate ? createLabel(trimmed) : null;
  const items = useMemo<ComboboxItem[]>(() => {
    const rows: ComboboxItem[] = list.options.map((option) => ({
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
  }, [createRowLabel, ids.listbox, list.options, trimmed]);

  const setInputValue = useCallback((next: string) => apply({ inputValue: next }), [apply]);

  // Safari does not focus a clicked button, so a dialog opened with nothing focused returns focus to the trigger.
  const rememberReturnFocus = useCallback(() => {
    returnFocusRef.current = document.activeElement === document.body ? triggerRef.current : null;
  }, []);

  const setOpen = useCallback(
    (next: boolean, reason: ComboboxCloseReason = 'trigger') => {
      const opening = next && !fieldNow().open;
      if (opening) {
        clearCreateError();
        // Each opening starts from the default row: the selected value, else the top one.
        highlight(null);
      }
      // Each time the dialog opens, start from the full list.
      // Reopened while still closing, focus is still inside: keep the query and the focus target.
      if (opening && isDialog && !inputRef.current?.closest('dialog')?.contains(document.activeElement)) {
        rememberReturnFocus();
        apply({ inputValue: '', open: true, reason });
        return;
      }
      apply({ open: next, reason });
    },
    [apply, clearCreateError, highlight, isDialog, rememberReturnFocus, fieldNow],
  );

  const create = useCallback(() => {
    // A closing dialog stays live, so a second Enter or click would run it again.
    if (!showCreate || (isDialog && !open)) return;
    const label = trimmed;
    runCreate(
      label,
      (signal) => latest.current.onCreate?.(label, signal),
      (canonical) => {
        const next = canonical ?? label;
        const now = fieldNow();
        if (selectionMode === 'single') {
          apply({ value: next, inputValue: label, open: false, reason: 'select' });
          return;
        }
        // Text typed while the create was pending stays.
        apply({
          value: now.multi.includes(next) ? now.multi : [...now.multi, next],
          ...(readsLabel(now.inputValue, label) ? { inputValue: '' } : {}),
        });
      },
    );
  }, [apply, fieldNow, isDialog, open, runCreate, selectionMode, showCreate, trimmed]);

  const select = useCallback(
    (raw: string) => {
      if (raw === CREATE_VALUE) {
        create();
        return;
      }
      if (isDialog && !open) return;
      clearCreateError();
      if (selectionMode === 'single') {
        // The pick replaces the value a pending create would set.
        cancelCreates();
        apply({ value: raw, inputValue: labelFor(raw), open: false, reason: 'select' });
        return;
      }
      const current = fieldNow().multi;
      const next = current.includes(raw) ? current.filter((item) => item !== raw) : [...current, raw];
      apply({ value: next, inputValue: '' });
    },
    [apply, cancelCreates, create, clearCreateError, isDialog, labelFor, open, selectionMode, fieldNow],
  );

  const remove = useCallback(
    (raw: string) => {
      const now = fieldNow();
      if (selectionMode === 'multiple') {
        clearCreateError();
        apply({ value: now.multi.filter((item) => item !== raw) });
      } else if (now.single === raw) {
        clearCreateError();
        apply({ value: null, inputValue: '' });
      }
    },
    [apply, clearCreateError, selectionMode, fieldNow],
  );

  const clear = useCallback(() => {
    cancelCreates();
    clearCreateError();
    apply({ value: selectionMode === 'multiple' ? [] : null, inputValue: '', open: false, reason: 'input-clear' });
  }, [apply, cancelCreates, clearCreateError, selectionMode]);

  const reset = useCallback(() => {
    const initial = latest.current;
    cancelCreates();
    clearCreateError();
    resetList();
    const defaultOpen = initial.defaultOpen ?? false;
    // Not setOpen: reopening a dialog there would clear the text reset puts back.
    if (defaultOpen && isDialog && !fieldNow().open) rememberReturnFocus();
    if (isMultiple(initial)) {
      apply({
        value: initial.defaultValue ?? [],
        inputValue: initial.defaultInputValue ?? '',
        open: defaultOpen,
        reason: 'reset',
      });
      return;
    }
    const defaultValue = initial.defaultValue ?? null;
    const defaultLabel = (initial.options ?? EMPTY_OPTIONS).find((option) => option.value === defaultValue)?.label;
    apply({
      value: defaultValue,
      inputValue: initial.defaultInputValue ?? defaultLabel ?? '',
      open: defaultOpen,
      reason: 'reset',
    });
  }, [apply, cancelCreates, clearCreateError, fieldNow, isDialog, rememberReturnFocus, resetList]);

  useEffect(() => {
    if (lastPresentation.current === presentation) return;
    lastPresentation.current = presentation;
    if (open) setOpen(false, 'blur');
  }, [open, presentation, setOpen]);

  // What Enter, or a chip input's commit key, does. False when it has nothing to
  // commit, as on a closed list: the key then belongs to the input and its form.
  const commitActive = useCallback((): boolean => {
    if (!open) return false;
    // Until this query's list is in, no row is active: hold the key rather than submit.
    if (!listIsCurrent) return true;
    // A pending create row holds the key too: create() waits for its request.
    if (activeValue === CREATE_VALUE) create();
    else if (activeValue) select(activeValue);
    else return false;
    return true;
  }, [activeValue, create, listIsCurrent, open, select]);

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (latest.current.disabled) return;
      if (isImeKeyEvent(event)) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        if (!open) {
          setOpen(true, 'trigger');
          if (event.key === 'ArrowUp' || event.key === 'End') move('last');
          else if (event.key === 'Home') move('first');
          return;
        }
        if (event.key === 'Home') move('first');
        else if (event.key === 'End') move('last');
        else move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (event.key === 'Enter') {
        // A held Enter picks once; its repeats would toggle the pick or submit the form.
        if (event.repeat) {
          event.preventDefault();
          return;
        }
        if (commitActive()) event.preventDefault();
        return;
      }
      if (event.key === 'Escape') {
        if (open) {
          event.preventDefault();
          if (isModal) setOpen(false, 'escape');
          return;
        }
        // With nothing to clear, Escape on a closed list goes on, so a dialog around it closes.
        const now = fieldNow();
        const clearsText = selectionMode === 'single' && !now.single && now.inputValue !== '';
        if (clearsText) {
          event.preventDefault();
          setInputValue('');
        }
        return;
      }
      if (event.key === 'Tab') {
        if (open) setOpen(false, 'blur');
      }
    },
    [commitActive, isModal, move, open, selectionMode, setInputValue, setOpen, fieldNow],
  );

  const changeInput = useCallback(
    (next: string) => {
      const cleared = selectionMode === 'single' && next === '';
      apply({ inputValue: next, ...(cleared ? { value: null } : {}), open: true, reason: 'trigger' });
    },
    [apply, selectionMode],
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

  const setTrigger = useComposedRefs(triggerRef);
  const triggerComposed = useStableComposedRef(setTrigger);
  const getTriggerProps = useCallback(
    (props: ButtonRootProps = {}): ButtonRootProps & { ref: RefCallback<HTMLButtonElement> } => {
      if (process.env.NODE_ENV !== 'production' && !isModal) {
        console.warn(
          'useCombobox: getTriggerProps is for sheet or dialog Button.Root. Popover mode uses getAnchorProps on Field.Root. Do not spread usePopover getTriggerProps.',
        );
      }
      const named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;
      return {
        ...props,
        ...(named ? {} : { 'aria-labelledby': `${ids.label} ${ids.trigger}` }),
        id: ids.trigger,
        ref: triggerComposed(props.ref),
        disabled: options.disabled || props.disabled,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': ids.listbox,
        onClick: composeHandlers(props.onClick, () => setOpen(!open, 'trigger')),
      };
    },
    [ids.label, ids.listbox, ids.trigger, isModal, open, options.disabled, setOpen, triggerComposed],
  );

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
        onCommit: commitActive,
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
      commitActive,
      inputValue,
      multiValue,
      onInputBlur,
      onInputFocus,
      onInputKeyDown,
      remove,
      selectionMode,
      labelFor,
    ],
  );

  const popover = usePopoverInternal(
    {
      open,
      // A read-only open has no one to ask, so the popover asks no one either.
      onOpenChange: options.open === undefined || options.onOpenChange ? setOpen : undefined,
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
      'aria-label': optionsName,
    }),
    [open, setOpen, optionsName],
  );

  const getLabelProps = useCallback(
    () => ({ id: ids.label, htmlFor: isModal ? ids.trigger : ids.input }),
    [ids.input, ids.label, ids.trigger, isModal],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !open) return;
    const list = document.getElementById(ids.listbox);
    if (!list || list.hasAttribute('aria-label')) return;
    const labelledBy = list.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
    if (labelledBy.some((id) => id && document.getElementById(id))) return;
    console.warn(
      'useCombobox: the listbox has no name. Spread getLabelProps() on the field\'s Label, or pass aria-label to getListboxProps().',
    );
  }, [ids.listbox, open]);

  const getListboxProps = useCallback(
    (
      props: ComboboxListboxNameProps = {},
    ): Omit<OptionListSingleProps, 'children'> | Omit<OptionListMultipleProps, 'children'> => {
      const name =
        props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
          ? props
          : { 'aria-labelledby': ids.label };
      if (selectionMode === 'multiple') {
        return {
          ...list.listboxProps,
          selectionMode: 'multiple',
          value: [...multiValue],
          onValueChange: (next: string[]) => {
            const added = next.find((item) => !multiValue.includes(item));
            const removed = multiValue.find((item) => !next.includes(item));
            const raw = added ?? removed;
            if (raw) select(raw);
          },
          ...name,
        };
      }
      return {
        ...list.listboxProps,
        selectionMode: 'single',
        value: singleValue,
        onValueChange: (next: string) => select(next),
        ...name,
      };
    },
    [ids.label, list.listboxProps, multiValue, select, selectionMode, singleValue],
  );

  const getOptionProps = useCallback(
    (item: ComboboxItem): OptionListOptionProps => {
      if (item.kind === 'create') {
        // Unavailable while its create is pending, but still reachable, so it keeps the highlight.
        return { value: CREATE_VALUE, children: item.label, 'aria-disabled': isCreatePending(item.value) || undefined };
      }
      return optionProps(item.option);
    },
    [isCreatePending, optionProps],
  );

  return {
    selectionMode,
    presentation,
    isSheet,
    open,
    inputValue,
    query: filterQuery.trim(),
    value,
    items,
    isEmpty: list.isEmpty,
    showCreate,
    activeId,
    activeValue,
    loading: list.loading,
    error: list.error,
    retry: list.retry,
    creating,
    createError,
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
    getLabelProps,
    getListboxProps,
    getOptionProps,
  };
}
