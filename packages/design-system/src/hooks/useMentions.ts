import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type Ref,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { useDomId } from '../internal/domId.js';
import { isImeKeyEvent } from '../internal/ime.js';
import type { FieldTextareaHighlight, FieldTextareaProps } from '../components/Field.js';
import type { OptionListOptionProps, OptionListSingleProps } from '../components/OptionList.js';
import { optionDomId } from '../internal/optionDomId.js';
import type { PopoverWire } from '../overlay/popoverWire.js';
import { composeHandlers, useComposedRefs, useStableComposedRef } from '../internal/props.js';
import { useStrings } from '../providers/StringsProvider.js';
import { useAnnouncer } from './useAnnouncer.js';
import type { ComboboxFilterOptions, ComboboxOption } from './optionList/types.js';
import { useOptionList } from './optionList/useOptionList.js';
import { useControlledState } from './useControlledState.js';
import {
  findQuery,
  sameTokens,
  shiftIndex,
  shiftTokens,
  validTokens,
  type MentionQuery,
  type MentionToken,
  type MentionTriggerPosition,
} from './useMentions.detect.js';
import { usePopoverInternal } from '../overlay/popover.js';

export type { MentionToken, MentionTriggerPosition } from './useMentions.detect.js';

/** The text and its tokens, which change together. */
export type MentionDraft = { text: string; tokens: readonly MentionToken[] };

export type MentionTrigger = {
  /** Every row there is. `filterOptions` picks the ones to show for the typed word. Ignored when `loadOptions` is set. */
  options?: readonly ComboboxOption[];
  /**
   * Picks the rows of `options` to show, and their order, for the word typed after the trigger
   * character, which is `''` right after it. Default: the rows whose label holds the word, ignoring
   * case, in their own order. Return a ranked or capped list to put better matches first. Ignored
   * when `loadOptions` is set.
   */
  filterOptions?: ComboboxFilterOptions;
  /**
   * Loads the rows for the typed word, and they show as it returns them. Stale responses are
   * discarded. With it set, `options` and `filterOptions` are ignored, and development warns.
   */
  loadOptions?: (query: string, signal: AbortSignal) => Promise<readonly ComboboxOption[]>;
  /** One character that starts a suggestion word, such as `@` or `/`. */
  char: string;
  /** `word`: at the start of the text or after whitespace. `start`: only whitespace before it, as slash commands are. */
  position?: MentionTriggerPosition;
  /** The text a pick inserts. Default: the trigger character and the option's label. */
  text?: (option: ComboboxOption) => string;
  /** The list's accessible name. Default: the `suggestions` string. */
  label?: string;
};

export type UseMentionsOptions = {
  triggers: readonly MentionTrigger[];
  /** The text and its tokens, controlled together. */
  value?: MentionDraft;
  defaultValue?: MentionDraft;
  /** Called with the next text and its tokens on every edit, including a pick. */
  onValueChange?: (value: { text: string; tokens: MentionToken[] }) => void;
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
  /** The text, and the tokens that still hold their text. */
  value: MentionDraft;
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
  /**
   * CSS anchor name on the token the caret is inside, while the suggestion
   * list is closed, and null otherwise. Pass it as `usePopover`'s
   * `anchorName` to show a peek at that token.
   */
  caretPeekAnchorName: string | null;
};

const EMPTY_DRAFT: MentionDraft = { text: '', tokens: [] };
const SPACE = /\s/;
/** Keys that move the caret without editing. */
const CARET_KEYS = /* @__PURE__ */ new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
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

/** The text the dismissed trigger index belongs to, and the last edit, which places its changed span. */
type Dismissal = {
  text: string;
  dismissed: number | null;
  /** The hook's own last edit: its text, its caret, and whether it replaced a selection holding the dismissed trigger. */
  edit: { text: string; caret: number | null; replacedDismissed: boolean } | null;
};

/** The collapsed caret of a textarea that takes typing, or null. */
function caretOf(el: HTMLTextAreaElement): number | null {
  if (el.readOnly || el.disabled) return null;
  return el.selectionStart === el.selectionEnd ? el.selectionStart : null;
}

/** The token whose text the caret sits in. A boundary belongs to the token that ends there. */
export function tokenAtCaret(tokens: readonly MentionToken[], caret: number): MentionToken | null {
  let match: MentionToken | null = null;
  for (const token of tokens) {
    if (caret > token.start && caret <= token.end) match = token;
  }
  return match;
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

  const [draft, setDraft] = useControlledState(options.value, options.defaultValue ?? EMPTY_DRAFT);
  const value = draft.text;
  const given = draft.tokens;
  // The tokens that still hold their text; the others are left out.
  const tokens = useMemo(() => validTokens(value, given), [given, value]);
  const shown = useMemo<MentionDraft>(
    () => (tokens === given || sameTokens(tokens, given) ? draft : { text: value, tokens }),
    [draft, given, tokens, value],
  );
  const [caret, setCaret] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  // Where the caret goes after a pick, once its text is in. Until then no list opens.
  const [caretAfter, setCaretAfter] = useState<{ to: number; value: string; from: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Tokens for texts seen before, so undo and redo bring back the tokens of
  // the text they restore. Read and written only in event handlers.
  const history = useRef(new Map<string, readonly MentionToken[]>());
  // The token a pick is inserting, read by the change event its native edit fires.
  const picking = useRef<MentionToken | null>(null);
  // The selection an edit replaces, read at beforeinput.
  const selectionBefore = useRef<{ start: number; end: number } | null>(null);

  // The trigger Escape closed the list for moves with the text.
  const [own, setOwn] = useState<Dismissal>(() => ({ text: value, dismissed: null, edit: null }));
  let dismissed = own.dismissed;
  if (own.text !== value) {
    // A text set from outside is a new draft, so nothing stays dismissed in it.
    const edited = own.edit?.text === value ? own.edit : null;
    dismissed =
      dismissed === null || !edited || edited.replacedDismissed ? null : shiftIndex(own.text, value, dismissed, edited.caret);
    setOwn({ text: value, dismissed, edit: null });
  }

  const remember = useCallback((text: string, list: readonly MentionToken[]) => {
    const map = history.current;
    map.delete(text);
    map.set(text, list);
    if (map.size > HISTORY) map.delete(map.keys().next().value!);
  }, []);

  /** Hands out a text and its tokens together. */
  const send = useCallback(
    (next: MentionDraft) => {
      setDraft(next);
      latest.current.onValueChange?.({ text: next.text, tokens: [...next.tokens] });
    },
    [setDraft],
  );

  /** Works out the tokens of an edit's text from the rendered text and tokens, then sends both. */
  const edit = useCallback(
    (next: string, how: { inputType?: string; caret: number | null; pick?: MentionToken | null }) => {
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
      const before = selectionBefore.current;
      selectionBefore.current = null;
      setOwn((current) => ({
        ...current,
        edit: {
          text: next,
          caret: how.caret,
          replacedDismissed:
            before !== null && current.dismissed !== null && before.start <= current.dismissed && current.dismissed < before.end,
        },
      }));
      send({ text: next, tokens: list });
    },
    [remember, send, tokens, value],
  );

  // A value set from outside, such as clearing the text after sending, can move the caret.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el && el.ownerDocument.activeElement === el) {
      // Focus can come before hydration, which onFocus never hears.
      if (el.ownerDocument.hasFocus()) setFocused(true);
      setCaret(caretOf(el));
    }
  }, [value]);

  // Waits for the picked text, which a parent may commit later; an edit, a caret key, a primary press or another text ends the wait.
  useLayoutEffect(() => {
    if (!caretAfter) return;
    if (value !== caretAfter.value) {
      // The product put another text in: the pick is not coming.
      if (value !== caretAfter.from) setCaretAfter(null);
      return;
    }
    setCaretAfter(null);
    const el = textareaRef.current;
    if (!el) return;
    el.setSelectionRange(caretAfter.to, caretAfter.to);
    setCaret(caretAfter.to);
  }, [caretAfter, value]);

  const triggers = options.triggers;
  // While a pick waits for its text, the caret belongs to neither text, so no word is being typed.
  const found = focused && caret !== null && caretAfter === null && !options.disabled ? findQuery(value, caret, triggers, tokens) : null;
  const query = found && found.start !== dismissed ? found : null;
  const trigger = query ? (triggers[query.trigger] ?? null) : null;
  const session = query ? `${query.trigger}:${query.start}` : null;
  const open = query !== null;

  const fits = useCallback(
    (option: ComboboxOption) => {
      const max = latest.current.maxLength;
      if (max === undefined || !query || !trigger) return true;
      const added = insertion(value, query, textOf(trigger, option)).length;
      return value.length - (query.end - query.start) + added <= max;
    },
    [query, trigger, value],
  );
  // Each trigger is its own list, so one trigger's loads never show on another's.
  const list = useOptionList({
    listboxId: ids.listbox,
    options: trigger?.options,
    loadOptions: trigger?.loadOptions,
    query: query?.query ?? null,
    filterOptions: trigger?.filterOptions,
    scope: query ? String(query.trigger) : undefined,
    canPick: fits,
  });
  const { activeValue, activeId: listActiveId, listIsCurrent, enabledValues, error, highlight, move } = list;
  const items = useMemo<MentionItem[]>(
    () => list.options.map((option) => ({ option, id: optionDomId(ids.listbox, option.value) })),
    [ids.listbox, list.options],
  );
  const activeId = open ? listActiveId : null;
  // A new word starts from its first row, even at the place an earlier word was.
  const [shownSession, setShownSession] = useState(session);
  if (shownSession !== session) {
    setShownSession(session);
    highlight(null);
  }

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

  const select = useCallback(
    (raw: string) => {
      const el = textareaRef.current;
      if (!query || !trigger || el?.readOnly || el?.disabled) return;
      const option = items.find((item) => item.option.value === raw)?.option;
      if (!option || option.disabled || !fits(option)) return;
      // A pick replaces the word, and no beforeinput reports that.
      selectionBefore.current = { start: query.start, end: query.end };
      const text = textOf(trigger, option);
      const inserted = insertion(value, query, text);
      const caretTo = query.start + inserted.length;
      const token: MentionToken = { start: query.start, end: query.start + text.length, char: trigger.char, value: option.value, text };
      const next = value.slice(0, query.start) + inserted + value.slice(query.end);
      if (next === value) {
        el?.setSelectionRange(caretTo, caretTo);
        setCaret(caretTo);
        const list = validTokens(value, [...tokens, token]);
        remember(value, list);
        selectionBefore.current = null;
        if (!sameTokens(list, tokens)) send({ text: value, tokens: list });
        return;
      }
      const doc = el?.ownerDocument;
      let native = false;
      // Set first: React may render the pick's change event inside execCommand.
      setCaretAfter({ to: caretTo, value: next, from: value });
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
      if (native) return;
      el?.focus();
      edit(next, { caret: caretTo, pick: token });
    },
    [edit, fits, items, query, remember, send, tokens, trigger, value],
  );

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    setCaret(caretOf(el));
    if (!picking.current) setCaretAfter(null);
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
    // A key that moves the caret ends the wait for a pick the product never commits; edits end it in onChange.
    if (caretAfter && CARET_KEYS.has(event.key)) setCaretAfter(null);
    if (latest.current.disabled) return;
    if (isImeKeyEvent(event, ['Enter', 'Tab'])) return;
    const plain = !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
    if (open) {
      // With nothing to move to, the arrows move the caret as usual.
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (enabledValues.length > 0 || !listIsCurrent)) {
        event.preventDefault();
        move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && plain) {
        // Enter while the word's list is still loading picks nothing and sends nothing,
        // even on a row of the last list, which is still showing.
        if (event.key === 'Enter' && !listIsCurrent) {
          event.preventDefault();
          return;
        }
        if (activeValue !== null && listIsCurrent) {
          event.preventDefault();
          select(activeValue);
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
      anchorName,
    },
    false,
  );

  // A caret moved by script or by a click fires selectionchange on the
  // textarea itself, which React's onSelect does not hear.
  const watchCaret = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const onChange = () => setCaret(caretOf(el));
    const onBeforeInput = () => {
      selectionBefore.current = { start: el.selectionStart, end: el.selectionEnd };
    };
    // A primary press on the textarea ends the wait for a pick the product never commits.
    const release = (event: PointerEvent) => {
      if (event.button === 0) setCaretAfter(null);
    };
    el.addEventListener('selectionchange', onChange);
    el.addEventListener('beforeinput', onBeforeInput);
    el.addEventListener('pointerdown', release);
    return () => {
      el.removeEventListener('selectionchange', onChange);
      el.removeEventListener('beforeinput', onBeforeInput);
      el.removeEventListener('pointerdown', release);
    };
  }, []);
  const ownRef = useComposedRefs(textareaRef, watchCaret);
  const composeRef = useStableComposedRef(ownRef);

  // The word's range is what the anchor follows; the query object changes every render.
  const queryStart = query?.start;
  const queryEnd = query?.end;
  const caretToken = !open && caret !== null ? tokenAtCaret(tokens, caret) : null;
  const caretPeekAnchorName = caretToken ? `--todae-mention-peek-${autoId}` : null;
  const highlights = useMemo<FieldTextareaHighlight[]>(() => {
    const list: FieldTextareaHighlight[] = tokens.map((token) => ({
      start: token.start,
      end: token.end,
      kind: token.char,
      anchorName:
        caretToken && token.start === caretToken.start && token.end === caretToken.end && token.value === caretToken.value
          ? caretPeekAnchorName ?? undefined
          : undefined,
    }));
    // The word being typed carries the anchor the list sits at, and is not drawn.
    if (queryStart !== undefined && queryEnd !== undefined) {
      list.push({ start: queryStart, end: Math.max(queryEnd, queryStart + 1), anchorName, draw: false });
    }
    return list.sort((a, b) => a.start - b.start);
  }, [anchorName, caretPeekAnchorName, caretToken, queryEnd, queryStart, tokens]);

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


  const getListboxProps = (): Omit<OptionListSingleProps, 'children'> => ({
    ...list.listboxProps,
    selectionMode: 'single',
    value: null,
    onValueChange: select,
    'aria-label': listName,
  });

  const getOptionProps = (item: MentionItem): OptionListOptionProps => list.getOptionProps(item.option);

  return {
    value: shown,
    open,
    trigger,
    query: query?.query ?? '',
    items,
    isEmpty: list.isEmpty,
    activeId,
    activeValue: open ? activeValue : null,
    loading: list.loading,
    error,
    retry: list.retry,
    ids,
    textareaRef,
    select,
    highlight,
    dismiss,
    getTextareaProps,
    getPopoverProps: popover.getPopoverProps,
    getListboxProps,
    getOptionProps,
    caretPeekAnchorName,
  };
}
