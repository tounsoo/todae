import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type MouseEvent,
  type Ref,
} from 'react';
import { activeIn } from './activeElement.js';
import { applyEdit, cleanCode, editOf, slotsOf, type CodeEdit, type CodeSelection, type OneTimeCodeCharacters } from './oneTimeCode.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import styles from './Field.module.css';
import { useField } from '../hooks/useField.js';
import { useStrings } from '../providers/StringsProvider.js';
import { useCustomValidity } from './customValidity.js';

/** What a code may hold: digits only, or digits and Latin letters. */
export type FieldOneTimeCodeCharacters = OneTimeCodeCharacters;

export type FieldOneTimeCodeProps = {
  /** The code: at most `length` characters of the allowed set. */
  value: string;
  /** Optional: `onValueChange` alone is enough when the event is not needed. The event holds the raw text; clean it, or use `onValueChange`. */
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Called with the code cleaned to the allowed characters and cut to `length`. Without it and `onChange` the input is read-only. */
  onValueChange?: (value: string) => void;
  /** How many characters the code has, and how many boxes are drawn. */
  length?: number;
  /** `digits` asks the phone for a numeric keypad and refuses other characters as they are typed. */
  characters?: FieldOneTimeCodeCharacters;
  /** On the element that draws the boxes, not on the input, which is transparent. */
  className?: string;
  /** On the element that draws the boxes, like `className`. */
  style?: CSSProperties;
  ref?: Ref<HTMLInputElement>;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'type' | 'onChange' | 'className' | 'style' | 'disabled' | 'maxLength' | 'minLength' | 'pattern' | 'inputMode' | 'dir'
>;

function readSelection(input: HTMLInputElement | null): CodeSelection | null {
  if (!input || activeIn(input) !== input) return null;
  return { start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 };
}

function sameSelection(a: CodeSelection | null, b: CodeSelection | null) {
  return a === b || (a !== null && b !== null && a.start === b.start && a.end === b.end);
}

/** The index of the box whose center is nearest `clientX`, the number of boxes when `clientX` is past the last one, or -1 without boxes. */
function nearestBox(slots: HTMLCollection | undefined, clientX: number) {
  const boxes = [...(slots ?? [])];
  const last = boxes.at(-1)?.getBoundingClientRect();
  // The input is always left to right, so the last box's inline end is its right.
  if (last && clientX > last.right) return boxes.length;
  let nearest = -1;
  let best = Infinity;
  for (const [i, slot] of boxes.entries()) {
    const box = slot.getBoundingClientRect();
    const distance = Math.abs(clientX - (box.left + box.right) / 2);
    if (distance < best) {
      best = distance;
      nearest = i;
    }
  }
  return nearest;
}

// Sets the value as the person's edit, with the caret at `caret`, and fires the input event that reaches `onChange`.
function write(input: HTMLInputElement, next: string, caret: number) {
  // The prototype's setter, not the instance's, which React watches to tell its own writes from the person's.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, next);
  input.setSelectionRange(caret, caret);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Puts `text` in place of the selection, and fires the input event that reaches `onChange`. It uses the input's own undo stack where the browser has one; elsewhere it writes the value itself.
function insert(input: HTMLInputElement, text: string) {
  const doc = input.ownerDocument;
  if (activeIn(input) === input && typeof doc.execCommand === 'function') {
    try {
      if (doc.execCommand(text ? 'insertText' : 'delete', false, text)) return;
    } catch {
      // Fall through to the written edit.
    }
  }
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  write(input, input.value.slice(0, start) + text + input.value.slice(end), start + text.length);
}

type Composition = { value: string; selection: CodeSelection; change?: ChangeEvent<HTMLInputElement> };

// The edit a composition makes: the text it left between what was before and after the selection it started on, by the rule.
function composedEdit(saved: Composition, live: string, options: { characters: OneTimeCodeCharacters; length: number }) {
  const after = saved.value.length - saved.selection.end;
  const text = live.slice(saved.selection.start, Math.max(live.length - after, saved.selection.start));
  return editOf(saved.value, saved.selection, text, options);
}

// The range of `live` to replace, and the text, that make it `target`: what lies between their common start and end.
function difference(live: string, target: string) {
  let start = 0;
  while (start < live.length && start < target.length && live[start] === target[start]) start++;
  let end = 0;
  while (end < live.length - start && end < target.length - start && live[live.length - 1 - end] === target[target.length - 1 - end]) end++;
  return { from: start, to: live.length - end, insert: target.slice(start, target.length - end) };
}

/**
 * A code for a sign-in or a verification, drawn as boxes over one native
 * input. The input keeps paste, undo, selection and the phone's code autofill
 * (`autocomplete="one-time-code"`), and the boxes are only drawn. Every insert
 * (typing, paste, a drop, a finished composition) follows one rule, `editOf`:
 * a whole code replaces the value, and anything shorter replaces the selection
 * and writes over what follows as far as it needs, so nothing typed moves out
 * of its box. A press on a box selects its character so typing replaces it.
 */
export function OneTimeCode({
  value,
  onChange,
  onValueChange,
  length = 6,
  characters = 'digits',
  className,
  style,
  readOnly,
  autoComplete = 'one-time-code',
  ref,
  onClick: onClickProp,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  ...props
}: FieldOneTimeCodeProps) {
  const field = useField();
  const strings = useStrings();
  const input = useRef<HTMLInputElement>(null);
  const slotsNode = useRef<HTMLSpanElement>(null);
  const inserting = useRef(false);
  // Set while an edit only brings the input back to the code the product already has, which onChange then doesn't hear.
  const restoring = useRef(false);
  // The value and selection a composition started from, which it is applied to when it ends, and its latest change event.
  const composition = useRef<Composition | null>(null);
  // The text a refused composition left, which the code never held, so undo and redo step over it.
  const unheld = useRef<string | null>(null);
  // While composing, the input's own text, and the code the boxes show: the composition applied by the rule.
  const [composing, setComposing] = useState<{ live: string; shown: string } | null>(null);
  const refs = useComposedRefs(input, ref);
  const fixed = readOnly ?? (!onChange && !onValueChange);
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const latest = useRef({ characters, length, fixed, value, report });
  useLayoutEffect(() => {
    latest.current = { characters, length, fixed, value, report };
  });

  // The browser's own tooShort skips an edit a script makes, a cleaned paste among them, so the length is checked here.
  useCustomValidity(
    input,
    () => input.current,
    value.length > 0 && value.length < length ? strings.tooShort(length) : undefined,
  );

  function sync() {
    const next = readSelection(input.current);
    setSelection((previous) => (sameSelection(previous, next) ? previous : next));
  }
  // A value your code sets can move the caret without any event.
  useEffect(sync);
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const doc = el.ownerDocument;
    function put({ from, to, insert: text }: CodeEdit) {
      el!.setSelectionRange(from, to);
      // A browser may fire beforeinput for the command insert uses, which would come back here.
      inserting.current = true;
      try {
        insert(el!, text);
      } finally {
        inserting.current = false;
      }
    }
    function apply(text: string, selection: CodeSelection) {
      const { characters, length } = latest.current;
      const edit = editOf(el!.value, selection, text, { characters, length });
      if (edit) put(edit);
    }
    // Every insert goes through the rule, typing too, so maxLength never decides where text lands.
    function onBeforeInput(event: InputEvent) {
      const { inputType } = event;
      // One the browser won't let be cancelled is cleaned by the change event instead, so its insert and this one don't both land.
      if (inserting.current || latest.current.fixed || event.isComposing || !event.cancelable || !inputType.startsWith('insert')) return;
      if (inputType === 'insertCompositionText' || inputType === 'insertFromComposition') return;
      const text = event.data ?? event.dataTransfer?.getData('text/plain');
      if (text == null) return;
      event.preventDefault();
      apply(text, { start: el!.selectionStart ?? 0, end: el!.selectionEnd ?? 0 });
    }
    function onDrop(event: DragEvent) {
      if (latest.current.fixed || event.defaultPrevented) return;
      // Cancelling the drop also cancels the drag's deleteByDrag, so text dragged inside the field is copied, not moved.
      event.preventDefault();
      const box = nearestBox(slotsNode.current?.children, event.clientX);
      const at = box < 0 ? el!.value.length : box;
      if (activeIn(el!) !== el) el!.focus();
      apply(event.dataTransfer?.getData('text/plain') ?? '', { start: at, end: at });
    }
    function onCompositionStart() {
      composition.current = { value: el!.value, selection: { start: el!.selectionStart ?? 0, end: el!.selectionEnd ?? 0 } };
      // Lifts maxLength, which would cut the commit on a full code, so the text the boxes show is the text that ends it.
      setComposing({ live: el!.value, shown: el!.value });
    }
    // The input already holds the commit, so the code is reached from it with one more edit, which keeps the undo history that setting the value would clear.
    function onCompositionEnd() {
      const saved = composition.current;
      // Cleared first, so the edit below reaches onChange as an edit.
      composition.current = null;
      if (saved) settle(saved);
      setComposing(null);
    }
    function settle(saved: Composition) {
      const { characters, length, fixed, value, report } = latest.current;
      const live = el!.value;
      // A value the product set while the person composed wins, and the composition is dropped.
      const edit = value === saved.value && !fixed ? composedEdit(saved, live, { characters, length }) : null;
      const target = value !== saved.value ? value : edit ? applyEdit(saved.value, edit) : saved.value;
      if (live !== target) {
        restoring.current = target === value;
        try {
          put(difference(live, target));
        } finally {
          restoring.current = false;
        }
        unheld.current = cleanCode(live, characters, length) === live ? null : live;
      } else if (target !== value && saved.change) {
        // The commit itself is the edit, and onChange hasn't heard it.
        report(saved.change);
      }
      if (activeIn(el!) !== el || value !== saved.value) return;
      if (edit) el!.setSelectionRange(edit.from + edit.insert.length, edit.from + edit.insert.length);
      else el!.setSelectionRange(saved.selection.start, saved.selection.end);
    }
    // The browser keeps the commit and the edit that replaced it as two steps; landing on the commit's text, which the code never held, goes on to the next step.
    function onInput(event: Event) {
      if (unheld.current === null || el!.value !== unheld.current) return;
      const { inputType } = event as InputEvent;
      if (inputType === 'historyUndo') doc.execCommand('undo');
      else if (inputType === 'historyRedo') doc.execCommand('redo');
    }
    el.addEventListener('beforeinput', onBeforeInput);
    el.addEventListener('compositionstart', onCompositionStart);
    el.addEventListener('compositionend', onCompositionEnd);
    el.addEventListener('input', onInput);
    el.addEventListener('drop', onDrop, true);
    doc.addEventListener('selectionchange', sync);
    return () => {
      el.removeEventListener('beforeinput', onBeforeInput);
      el.removeEventListener('compositionstart', onCompositionStart);
      el.removeEventListener('compositionend', onCompositionEnd);
      el.removeEventListener('input', onInput);
      el.removeEventListener('drop', onDrop, true);
      doc.removeEventListener('selectionchange', sync);
    };
  }, []);

  function onChangeInput(event: ChangeEvent<HTMLInputElement>) {
    const saved = composition.current;
    if ((event.nativeEvent as InputEvent).isComposing) {
      // React writes `value` back after a change event, and a write ends the composition, so the input keeps its own text until the composition ends and is applied.
      const live = event.target.value;
      let shown = saved?.value ?? value;
      if (saved) {
        saved.change = event;
        const edit = composedEdit(saved, live, { characters, length });
        if (edit) shown = applyEdit(saved.value, edit);
      }
      setComposing({ live, shown });
      sync();
      return;
    }
    if (restoring.current) {
      setComposing(null);
      sync();
      return;
    }
    report(event);
  }

  function report(event: ChangeEvent<HTMLInputElement>) {
    setComposing(null);
    onChange?.(event);
    // Autofill that skips beforeinput can bring characters the code doesn't allow.
    onValueChange?.(cleanCode(event.target.value, characters, length));
    sync();
  }

  // A press on a box selects its character, so typing replaces it; a press on an empty box or past the last one puts the caret after the code, and a double press selects the whole code. Done on click rather than by cancelling the press, so a phone focuses natively and keeps its keyboard.
  function onClick(event: MouseEvent<HTMLInputElement>) {
    const target = event.currentTarget;
    // The first press selected one box, which the browser's word selection keeps, so the second selects the code itself.
    if (event.detail === 2) {
      target.setSelectionRange(0, target.value.length);
      sync();
      return;
    }
    const nearest = nearestBox(slotsNode.current?.children, event.clientX);
    // Only a press: a label's click and an assistive technology's carry no position of the person's.
    if (event.detail !== 1 || nearest < 0) return;
    // The press collapsed the caret, so a range is a drag or a Shift+click that selected on purpose.
    if (target.selectionStart !== target.selectionEnd) return;
    if (nearest < value.length) target.setSelectionRange(nearest, nearest + 1);
    else target.setSelectionRange(value.length, value.length);
    sync();
  }

  const control = field.getControlProps({ ...props, ref: refs });
  const shown = composing?.shown ?? value;
  const slots = slotsOf(shown, selection, length);
  // The caret after a full code is in no box, so the row itself shows the focus.
  const rowActive = selection !== null && !slots.some((slot) => slot.active);
  return (
    <span className={cx(styles.oneTimeCode, className)} style={style}>
      <input
        {...control}
        type="text"
        inputMode={characters === 'digits' ? 'numeric' : 'text'}
        autoComplete={autoComplete}
        maxLength={composing ? undefined : length}
        pattern={characters === 'digits' ? '[0-9]*' : '[A-Za-z0-9]*'}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        dir="ltr"
        data-todae-one-time-code=""
        value={composing?.live ?? value}
        readOnly={fixed}
        className={styles.oneTimeCodeInput}
        onChange={onChangeInput}
        onClick={composeHandlers(onClickProp, onClick)}
        onFocus={(event) => {
          onFocusProp?.(event);
          sync();
        }}
        onBlur={(event) => {
          onBlurProp?.(event);
          setSelection(null);
        }}
      />
      <span ref={slotsNode} className={styles.slots} data-todae-focus-ring="" data-active={rowActive ? '' : undefined} aria-hidden="true">
        {slots.map((slot, i) => (
          <span
            key={i}
            className={styles.slot}
            data-active={slot.active ? '' : undefined}
            data-filled={slot.filled ? '' : undefined}
            data-caret={slot.caret ? '' : undefined}
          >
            {shown.charAt(i)}
          </span>
        ))}
      </span>
    </span>
  );
}
