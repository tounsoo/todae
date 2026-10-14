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

/** What the hook knows about the edit that produced a text, from the change event. */
type EditHint = { id: number; value: string; inputType?: string; caret: number | null; pick?: MentionToken };

/** The text the tokens were last carried to, and what came with it. */
type Track = {
  value: string;
  /** The tokens prop or state the hook last saw. New tokens in it replace the hook's. */
  raw: readonly MentionToken[];
  tokens: readonly MentionToken[];
  /** The trigger index Escape or a press outside closed the list for. It moves with edits. */
  dismissed: number | null;
  /** Bumped when the hook changes the tokens itself, so they are handed out once. */
  version: number;
  hint: number;
};

/**
 * Carries the tokens to a newly rendered text. Tokens passed in from outside
 * win; otherwise the edit moves them, undo and redo restore the tokens the
 * restored text had, and a pick adds its token once its text is there.
 */
function advance(
  prev: Track,
  value: string,
  raw: readonly MentionToken[],
  hint: EditHint | null,
  history: ReadonlyMap<string, readonly MentionToken[]>,
): Track {
  // Tokens from outside are new ones: not the ones last seen, and not the
  // hook's own handed back. A copy with the same tokens is the same.
  if (!sameTokens(raw, prev.raw) && !sameTokens(raw, prev.tokens)) {
    const tokens = validTokens(value, raw);
    const changed = !sameTokens(tokens, raw);
    return {
      value,
      raw,
      tokens,
      dismissed: value === prev.value ? prev.dismissed : null,
      version: changed ? prev.version + 1 : prev.version,
      hint: hint?.id ?? prev.hint,
    };
  }
  const edit = hint && hint.id !== prev.hint && hint.value === value ? hint : null;
  const restored =
    edit?.inputType === 'historyUndo' || edit?.inputType === 'historyRedo' ? history.get(value) : undefined;
  let tokens: readonly MentionToken[];
  if (restored) tokens = validTokens(value, restored);
  else {
    tokens = shiftTokens(prev.value, value, prev.tokens, edit?.caret);
    const pick = edit?.pick;
    if (pick && value.slice(pick.start, pick.end) === pick.text) tokens = validTokens(value, [...tokens, pick]);
  }
  const changed = !sameTokens(tokens, prev.tokens);
  return {
    value,
    raw,
    tokens: changed ? tokens : prev.tokens,
    dismissed: prev.dismissed === null ? null : shiftIndex(prev.value, value, prev.dismissed, edit?.caret),
    version: changed ? prev.version + 1 : prev.version,
    hint: hint?.id ?? prev.hint,
  };
}

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
  const [tokenState, setTokenState] = useControlledState(options.tokens, options.defaultTokens ?? EMPTY_TOKENS);
  const [caret, setCaret] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState<{ session: string; value: string | null } | null>(null);
  const [hint, setHint] = useState<EditHint | null>(null);
  // Where the caret goes after a pick that could not edit the textarea natively, once its text is in.
  const [caretAfter, setCaretAfter] = useState<{ to: number; value: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Tokens for texts seen before, so undo and redo bring back the tokens of the text they restore.
  const history = useRef(new Map<string, readonly MentionToken[]>());
  // The token a pick is inserting, read by the change event its native edit fires.
  const picking = useRef<MentionToken | null>(null);
  const hints = useRef(0);

  // The tokens follow the rendered text, worked out while rendering so the
  // text and its tokens never disagree, as React's docs do for state that
  // follows a prop.
  const [trackState, setTrack] = useState<Track>(() => {
    const tokens = validTokens(value, tokenState);
    const changed = !sameTokens(tokens, tokenState);
    return { value, raw: tokenState, tokens, dismissed: null, version: changed ? 1 : 0, hint: 0 };
  });
  let track = trackState;
  // Compared by content, so a parent that passes a new array with the same
  // tokens on each render settles.
  if (track.value !== value || !sameTokens(track.raw, tokenState)) {
    track = advance(track, value, tokenState, hint, history.current);
    setTrack(track);
  }
  const tokens = track.tokens;
  const dismissed = track.dismissed;

  const handedOut = useRef(0);
  useEffect(() => {
    const map = history.current;
    map.delete(track.value);
    map.set(track.value, track.tokens);
    if (map.size > HISTORY) map.delete(map.keys().next().value!);
    if (track.version === handedOut.current) return;
    handedOut.current = track.version;
    setTokenState(track.tokens);
    latest.current.onTokensChange?.([...track.tokens]);
  }, [setTokenState, track]);

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
    setTrack((current) => ({ ...current, dismissed: start }));
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
      hints.current += 1;
      setHint({ id: hints.current, value: next, caret: caretTo, pick: token });
      setCaretAfter({ to: caretTo, value: next });
      setValue(next);
    },
    [fits, items, query, setValue, trigger, value],
  );

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const at = caretOf(el);
    hints.current += 1;
    setHint({
      id: hints.current,
      value: el.value,
      inputType: (event.nativeEvent as InputEvent).inputType,
      caret: el.selectionStart === el.selectionEnd ? el.selectionStart : null,
      pick: picking.current ?? undefined,
    });
    setCaret(at);
    setCaretAfter(null);
    setValue(el.value);
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
