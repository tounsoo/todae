import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type Ref,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { useDomId } from '../components/domId';
import type { FieldTextareaHighlight, FieldTextareaProps } from '../components/Field';
import type { OptionListOptionProps, OptionListSingleProps } from '../components/OptionList';
import { optionDomId } from '../components/OptionList.ids';
import type { PopoverWire } from '../components/Popover.wire';
import { composeHandlers, useComposedRefs, useStableComposedRef } from '../components/props';
import { useStrings } from '../providers/StringsProvider';
import { useAnnouncer } from './useAnnouncer';
import { createAsyncGate } from './useCombobox.async';
import { defaultFilter, filterOptions } from './useCombobox.filter';
import type { ComboboxOption } from './useCombobox.types';
import { useControlledState } from './useControlledState';
import {
  findQuery,
  sameTokens,
  shiftIndex,
  shiftTokens,
  validTokens,
  type MentionQuery,
  type MentionToken,
  type MentionTriggerPosition,
} from './useMentions.detect';
import { usePopoverInternal } from './usePopover';

export type { MentionToken, MentionTriggerPosition } from './useMentions.detect';

export type MentionTrigger = {
  /** One character that starts a suggestion word, such as `@` or `/`. */
  char: string;
  /** `word`: at the start of the text or after whitespace. `start`: only whitespace before it, as slash commands are. */
  position?: MentionTriggerPosition;
  /** Sync options. Ignored when loadOptions is set. */
  options?: readonly ComboboxOption[];
  /** Async options for the typed word. Stale responses are discarded. */
  loadOptions?: (query: string, signal: AbortSignal) => Promise<readonly ComboboxOption[]>;
  /** Filters sync options. Default: the label contains the query, ignoring case. */
  filter?: (option: ComboboxOption, query: string) => boolean;
  /** The text a pick inserts. Default: the trigger character and the option's label. */
  text?: (option: ComboboxOption) => string;
  /** The list's accessible name. Default: the `suggestions` string. */
  label?: string;
};

export type UseMentionsOptions = {
  triggers: readonly MentionTrigger[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** The committed tokens, as ranges of the text. Pass them with `value` to load a draft. */
  tokens?: readonly MentionToken[];
  defaultTokens?: readonly MentionToken[];
  onTokensChange?: (tokens: MentionToken[]) => void;
  /** The textarea's maxLength. A pick that would not fit is disabled. */
  maxLength?: number;
  disabled?: boolean;
  id?: string;
};

export type MentionItem = { option: ComboboxOption; id: string };

type TextareaWire = Pick<
  FieldTextareaProps,
  | 'value'
  | 'onChange'
  | 'onSelect'
  | 'onKeyDown'
  | 'onFocus'
  | 'onBlur'
  | 'highlights'
  | 'aria-autocomplete'
  | 'aria-haspopup'
  | 'aria-controls'
  | 'aria-activedescendant'
> & { value: string; ref: Ref<HTMLTextAreaElement> };

export type UseMentionsTextareaProps = Partial<FieldTextareaProps>;

export type UseMentionsResult = {
  value: string;
  tokens: readonly MentionToken[];
  open: boolean;
  /** The trigger of the word being typed, while there is one. */
  trigger: MentionTrigger | null;
  /** The text after the trigger character, up to the end of the word. */
  query: string;
  items: MentionItem[];
  isEmpty: boolean;
  activeId: string | null;
  activeValue: string | null;
  loading: boolean;
  error: unknown | null;
  retry: () => void;
  ids: { listbox: string };
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  select: (value: string) => void;
  highlight: (value: string | null) => void;
  dismiss: () => void;
  getTextareaProps: <P extends UseMentionsTextareaProps>(props?: P) => Omit<P, keyof TextareaWire> & TextareaWire;
  getPopoverProps: () => PopoverWire;
  getListboxProps: () => Omit<OptionListSingleProps, 'children'>;
  getOptionProps: (item: MentionItem) => OptionListOptionProps;
};

const EMPTY_TOKENS: readonly MentionToken[] = [];
const EMPTY_OPTIONS: readonly ComboboxOption[] = [];
const SPACE = /\s/;
/** How many texts the undo history remembers tokens for. */
const HISTORY = 100;

function textOf(trigger: MentionTrigger, option: ComboboxOption): string {
  return trigger.text ? trigger.text(option) : `${trigger.char}${option.label}`;
}

/** What a pick replaces the word with: the token, and a space unless whitespace follows already. */
function insertion(value: string, query: MentionQuery, text: string): string {
  const after = value[query.end];
  return after !== undefined && SPACE.test(after) ? text : `${text} `;
}

/** A text with the tokens and dismissed trigger that belong to it. */
type Snap = {
  text: string;
  tokens: readonly MentionToken[];
  /** The trigger index Escape or a press outside closed the list for. It moves with edits. */
  dismissed: number | null;
};

/** The collapsed caret of a textarea that takes typing, or null. */
function caretOf(el: HTMLTextAreaElement): number | null {
  if (el.readOnly || el.disabled) return null;
  return el.selectionStart === el.selectionEnd ? el.selectionStart : null;
}

export function useMentions(options: UseMentionsOptions): UseMentionsResult {
  const strings = useStrings();
  const announce = useAnnouncer();
  const autoId = useDomId();
  const uid = options.id?.replaceAll(':', '') ?? autoId;
  const ids = useMemo(() => ({ listbox: `todae-mentions-list-${uid}` }), [uid]);
  // A CSS ident, so it comes from useDomId, not from the id option.
  const anchorName = `--todae-mention-${autoId}`;
  const latest = useRef(options);
  latest.current = options;

  const [value, setValueState] = useControlledState(options.value, options.defaultValue ?? '');
  const [caret, setCaret] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState<{ session: string; value: string | null } | null>(null);
  // Where the caret goes after a pick that could not edit the textarea natively, once its text is in.
  const [caretAfter, setCaretAfter] = useState<{ to: number; value: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Tokens for texts seen before, so undo and redo bring back the tokens of
  // the text they restore. Read and written only in event handlers.
  const history = useRef(new Map<string, readonly MentionToken[]>());
  // The token a pick is inserting, read by the change event its native edit fires.
  const picking = useRef<MentionToken | null>(null);

  // The hook's own tokens, kept with the text they belong to. An edit works
  // out the next text's tokens when it happens, and holds them as `pending`
  // until that text renders; a text set from outside carries the tokens along.
  const [own, setOwn] = useState<Snap & { pending: Snap | null }>(() => ({
    text: value,
    tokens: validTokens(value, options.tokens ?? options.defaultTokens ?? EMPTY_TOKENS),
    dismissed: null,
    pending: null,
  }));
  let snap: Snap = own;
  if (own.text !== value) {
    const next =
      own.pending?.text === value
        ? own.pending
        : {
            text: value,
            tokens: shiftTokens(own.text, value, own.tokens),
            dismissed: own.dismissed === null ? null : shiftIndex(own.text, value, own.dismissed),
          };
    snap = next;
    setOwn({ ...next, pending: null });
  }
  // Controlled tokens are the product's, like a controlled value; the hook
  // shows the ones that still hold their text.
  const controlledTokens = options.tokens;
  const shownControlled = useMemo(
    () => (controlledTokens === undefined ? null : validTokens(value, controlledTokens)),
    [controlledTokens, value],
  );
  const tokens = shownControlled ?? snap.tokens;
  const dismissed = snap.dismissed;

  // The tokens the hook last handed to onTokensChange, or was given at the start.
  const handed = useRef<readonly MentionToken[]>(options.tokens ?? options.defaultTokens ?? EMPTY_TOKENS);
  // The text those tokens are for. A controlled parent that sets the text
  // before the tokens, such as in a transition, is caught up, not changed.
  const handedFor = useRef<string | null>(null);
  // Hands out tokens that changed without an edit handing them out: a text set
  // from outside, starting tokens that don't hold their text, and uncontrolled edits.
  useLayoutEffect(() => {
    const controlled = latest.current.tokens !== undefined;
    if (controlled && value === handedFor.current) return;
    const held = latest.current.tokens ?? handed.current;
    if (sameTokens(tokens, held) || sameTokens(tokens, handed.current)) return;
    handed.current = tokens;
    handedFor.current = value;
    latest.current.onTokensChange?.([...tokens]);
  });

  const remember = (text: string, list: readonly MentionToken[]) => {
    const map = history.current;
    map.delete(text);
    map.set(text, list);
    if (map.size > HISTORY) map.delete(map.keys().next().value!);
  };

  /** Works out the tokens of an edit's text against the rendered text, then sends the text. */
  const edit = (next: string, how: { inputType?: string; caret: number | null; pick?: MentionToken | null }) => {
    const restored =
      how.inputType === 'historyUndo' || how.inputType === 'historyRedo' ? history.current.get(next) : undefined;
    let list: readonly MentionToken[];
    if (restored) list = validTokens(next, restored);
    else {
      list = shiftTokens(value, next, tokens, how.caret);
      const pick = how.pick;
      if (pick && next.slice(pick.start, pick.end) === pick.text) list = validTokens(next, [...list, pick]);
    }
    remember(value, tokens);
    remember(next, list);
    const nextDismissed = dismissed === null ? null : shiftIndex(value, next, dismissed, how.caret);
    setOwn({ text: value, tokens, dismissed, pending: { text: next, tokens: list, dismissed: nextDismissed } });
    if (latest.current.tokens !== undefined && !sameTokens(list, tokens)) {
      handed.current = list;
      handedFor.current = next;
      latest.current.onTokensChange?.([...list]);
    }
    setValue(next);
  };

  // A value set from outside, such as clearing the text after sending, can move the caret.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el && el.ownerDocument.activeElement === el) setCaret(caretOf(el));
  }, [value]);

  // Waits for the picked text, which a parent may commit later; typing clears it.
  useLayoutEffect(() => {
    if (!caretAfter || value !== caretAfter.value) return;
    setCaretAfter(null);
    const el = textareaRef.current;
    if (!el) return;
    el.setSelectionRange(caretAfter.to, caretAfter.to);
    setCaret(caretAfter.to);
  }, [caretAfter, value]);

  const setValue = useCallback(
    (next: string) => {
      setValueState(next);
      latest.current.onValueChange?.(next);
    },
    [setValueState],
  );

  const triggers = options.triggers;
  const found = focused && caret !== null && !options.disabled ? findQuery(value, caret, triggers, tokens) : null;
  const query = found && found.start !== dismissed ? found : null;
  const trigger = query ? (triggers[query.trigger] ?? null) : null;
  const session = query ? `${query.trigger}:${query.start}` : null;
  const open = query !== null;

  // The last settled load and the trigger and word it was for, so one
  // trigger's results or error never show on another's list.
  const [loaded, setLoaded] = useState<{ for: string; options: readonly ComboboxOption[]; error: unknown | null } | null>(
    null,
  );
  const [reloads, setReloads] = useState(0);
  const gate = useRef(createAsyncGate());
  const hasLoader = Boolean(trigger?.loadOptions);
  const loadFor = query ? `${query.trigger}:${query.query}` : null;

  useEffect(() => {
    if (!hasLoader || loadFor === null || !query) return;
    const load = latest.current.triggers[query.trigger]?.loadOptions;
    if (!load) return;
    setLoaded(null);
    void gate.current.next(query.query, load).then((result) => {
      if (!gate.current.isCurrent(result.gen)) return;
      if ('aborted' in result && result.aborted) return;
      setLoaded(
        'error' in result
          ? { for: loadFor, options: EMPTY_OPTIONS, error: result.error }
          : { for: loadFor, options: result.result, error: null },
      );
    });
    // The query object changes every render; loadFor names what it loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoader, loadFor, reloads]);

  useEffect(() => {
    const current = gate.current;
    return () => current.abort();
  }, []);

  const current = hasLoader && loaded !== null && loaded.for === loadFor ? loaded : null;
  const listIsCurrent = !hasLoader || current !== null;
  const loading = open && hasLoader && current === null;
  const error = current?.error ?? null;
  const source = !trigger ? EMPTY_OPTIONS : hasLoader ? (current?.options ?? EMPTY_OPTIONS) : (trigger.options ?? EMPTY_OPTIONS);
  const filter = trigger?.filter ?? defaultFilter;
  const items = useMemo<MentionItem[]>(() => {
    if (!query) return [];
    const shown = hasLoader ? source : filterOptions(source, query.query, filter);
    return shown.map((option) => ({ option, id: optionDomId(ids.listbox, option.value) }));
    // query.query is what filters; the object itself changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, hasLoader, ids.listbox, query?.query, source]);

  const fits = useCallback(
    (option: ComboboxOption) => {
      const max = latest.current.maxLength;
      if (max === undefined || !query || !trigger) return true;
      const added = insertion(value, query, textOf(trigger, option)).length;
      return value.length - (query.end - query.start) + added <= max;
    },
    [query, trigger, value],
  );
  const enabledValues = items.filter((item) => !item.option.disabled && fits(item.option)).map((item) => item.option.value);
  const chosen = active && active.session === session ? active.value : null;
  const activeValue =
    chosen !== null && enabledValues.includes(chosen) ? chosen : listIsCurrent ? (enabledValues[0] ?? null) : null;
  const activeId = open && activeValue !== null ? optionDomId(ids.listbox, activeValue) : null;
  const isEmpty = open && listIsCurrent && items.length === 0 && error == null;

  const listName = trigger?.label ?? strings.suggestions;
  // A failed load is not "no suggestions", so it announces nothing.
  const count = open && listIsCurrent && error == null ? items.length : null;
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (count === null || session === null) {
      announced.current = null;
      return;
    }
    const key = `${session}:${count}`;
    if (announced.current === key) return;
    announced.current = key;
    announce(strings.suggestionCount(count));
  }, [announce, count, session, strings]);

  const dismiss = useCallback(() => {
    const start = query?.start ?? null;
    if (start === null) return;
    setOwn((current) => ({ ...current, dismissed: start }));
  }, [query?.start]);

  const highlight = useCallback(
    (next: string | null) => {
      if (session !== null) setActive({ session, value: next });
    },
    [session],
  );

  const move = (delta: number) => {
    if (enabledValues.length === 0) return;
    const index = activeValue === null ? -1 : enabledValues.indexOf(activeValue);
    const next = index === -1 ? (delta > 0 ? 0 : enabledValues.length - 1) : Math.min(Math.max(index + delta, 0), enabledValues.length - 1);
    highlight(enabledValues[next] ?? null);
  };

  const select = useCallback(
    (raw: string) => {
      const el = textareaRef.current;
      if (!query || !trigger || el?.readOnly || el?.disabled) return;
      const option = items.find((item) => item.option.value === raw)?.option;
      if (!option || option.disabled || !fits(option)) return;
      const text = textOf(trigger, option);
      const inserted = insertion(value, query, text);
      const caretTo = query.start + inserted.length;
      const token: MentionToken = { start: query.start, end: query.start + text.length, char: trigger.char, value: option.value, text };
      const doc = el?.ownerDocument;
      let native = false;
      // insertText puts the pick on the textarea's own undo stack, and fires
      // the input event that reaches onChange.
      if (el && doc && doc.activeElement === el && typeof doc.execCommand === 'function') {
        el.setSelectionRange(query.start, query.end);
        picking.current = token;
        try {
          native = doc.execCommand('insertText', false, inserted);
        } catch {
          native = false;
        }
        picking.current = null;
      }
      if (native && el) {
        el.setSelectionRange(caretTo, caretTo);
        setCaret(caretTo);
        return;
      }
      el?.focus();
      const next = value.slice(0, query.start) + inserted + value.slice(query.end);
      setCaretAfter({ to: caretTo, value: next });
      edit(next, { caret: caretTo, pick: token });
    },
    // edit reads the rendered text and tokens, which value and tokens stand for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fits, items, query, tokens, trigger, value],
  );

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    setCaret(caretOf(el));
    setCaretAfter(null);
    edit(el.value, {
      inputType: (event.nativeEvent as InputEvent).inputType,
      caret: el.selectionStart === el.selectionEnd ? el.selectionStart : null,
      pick: picking.current,
    });
  };

  const onSelect = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    setCaret(caretOf(event.currentTarget));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (latest.current.disabled) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const el = event.currentTarget;
    const plain = !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
    if (open) {
      // With nothing to move to, the arrows move the caret as usual.
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (enabledValues.length > 0 || !listIsCurrent)) {
        event.preventDefault();
        move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && plain) {
        if (activeValue !== null) {
          event.preventDefault();
          select(activeValue);
          return;
        }
        // Enter while the word's list is still loading picks nothing and sends nothing.
        if (event.key === 'Enter' && !listIsCurrent) {
          event.preventDefault();
          return;
        }
        dismiss();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
        return;
      }
    }
    // Backspace at a token's end, or Delete at its start, selects the whole
    // token, so the key removes it in one step the textarea can undo.
    if ((event.key === 'Backspace' || event.key === 'Delete') && plain && el.selectionStart === el.selectionEnd) {
      const at = el.selectionStart;
      const token = tokens.find((item) => (event.key === 'Backspace' ? item.end === at : item.start === at));
      if (token) el.setSelectionRange(token.start, token.end);
    }
  };

  const onFocus = (event: FocusEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    setFocused(true);
    setCaret(caretOf(el));
  };

  const onBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.ownerDocument.getElementById(ids.listbox)?.contains(next)) return;
    setFocused(false);
  };

  const popover = usePopoverInternal(
    {
      open,
      onOpenChange: (next) => {
        if (!next) dismiss();
      },
      anchorRef: textareaRef,
      initialFocusRef: textareaRef,
      restoreFocusRef: textareaRef,
    },
    false,
  );

  // A caret moved by script or by a click fires selectionchange on the
  // textarea itself, which React's onSelect does not hear.
  const watchCaret = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const onChange = () => setCaret(caretOf(el));
    el.addEventListener('selectionchange', onChange);
    return () => el.removeEventListener('selectionchange', onChange);
  }, []);
  const ownRef = useComposedRefs(textareaRef, watchCaret);
  const composeRef = useStableComposedRef(ownRef);

  const highlights = useMemo<FieldTextareaHighlight[]>(() => {
    const list: FieldTextareaHighlight[] = tokens.map((token) => ({
      start: token.start,
      end: token.end,
      kind: token.char,
    }));
    // The word being typed carries the anchor the list sits at, and is not drawn.
    if (query) list.push({ start: query.start, end: Math.max(query.end, query.start + 1), anchorName, draw: false });
    return list.sort((a, b) => a.start - b.start);
    // query's range is what matters; the object changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorName, query?.end, query?.start, tokens]);

  const getTextareaProps = <P extends UseMentionsTextareaProps>(props?: P): Omit<P, keyof TextareaWire> & TextareaWire => {
    const user = (props ?? {}) as P;
    return {
      ...user,
      ref: composeRef(user.ref),
      value,
      onChange: composeHandlers(user.onChange, onChange),
      onSelect: composeHandlers(user.onSelect, onSelect),
      onKeyDown: composeHandlers(user.onKeyDown, onKeyDown),
      onFocus: composeHandlers(user.onFocus, onFocus),
      onBlur: composeHandlers(user.onBlur, onBlur),
      highlights,
      'aria-autocomplete': 'list',
      'aria-haspopup': 'listbox',
      'aria-controls': open ? ids.listbox : undefined,
      'aria-activedescendant': activeId ?? undefined,
    };
  };

  const getPopoverProps = (): PopoverWire => {
    const wire = popover.getPopoverProps();
    return {
      ...wire,
      style: {
        ...wire.style,
        ['--todae-popover-anchor' as string]: anchorName,
        positionAnchor: anchorName,
      } as CSSProperties,
    };
  };

  const getListboxProps = (): Omit<OptionListSingleProps, 'children'> => ({
    id: ids.listbox,
    selectionMode: 'single',
    value: null,
    onValueChange: select,
    activeValue,
    onActiveValueChange: highlight,
    tabIndex: -1,
    'aria-label': listName,
  });

  const getOptionProps = (item: MentionItem): OptionListOptionProps => ({
    value: item.option.value,
    children: item.option.label,
    disabled: item.option.disabled || !fits(item.option),
  });

  return {
    value,
    tokens,
    open,
    trigger,
    query: query?.query ?? '',
    items,
    isEmpty,
    activeId,
    activeValue: open ? activeValue : null,
    loading,
    error: open ? error : null,
    retry: () => setReloads((n) => n + 1),
    ids,
    textareaRef,
    select,
    highlight,
    dismiss,
    getTextareaProps,
    getPopoverProps,
    getListboxProps,
    getOptionProps,
  };
}
