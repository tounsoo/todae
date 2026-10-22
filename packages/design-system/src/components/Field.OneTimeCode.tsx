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
  type RefObject,
} from 'react';
import { activeIn } from './activeElement.js';
import { difference, editOf, reconcile, slotsOf, type CodeEdit, type CodeSelection, type OneTimeCodeCharacters } from './oneTimeCode.js';
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

// Makes `edit` as the person's own, with `inserting` set while it runs.
function put(input: HTMLInputElement, { from, to, insert: text }: CodeEdit, inserting: RefObject<boolean>) {
  input.setSelectionRange(from, to);
  // A browser may fire beforeinput for the command insert uses, which would come back to the listener.
  inserting.current = true;
  try {
    insert(input, text);
  } finally {
    inserting.current = false;
  }
}

/**
 * A code for a sign-in or a verification, drawn as boxes over one native
 * input. The input keeps paste, undo, selection and the phone's code autofill
 * (`autocomplete="one-time-code"`), and the boxes are only drawn. Every insert
 * Todae puts in (typing, paste, a drop) follows one rule, `editOf`: a whole
 * code replaces the value, and anything shorter replaces the selection and
 * writes over what follows as far as it needs, so nothing typed moves out of
 * its box. A change the browser makes (autofill, an insert it won't let be
 * cancelled, a composition) is read back by the same rule, through
 * `reconcile`. A press on a box selects its character so typing replaces it.
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
  // The code a composition started from, and the last code it reported while it ran.
  const composition = useRef<{ start: string; reported: string | null } | null>(null);
  // While composing, the input's own text, which React renders so it writes nothing that would end the IME, and the code the boxes show.
  const [composing, setComposing] = useState<{ live: string; shown: string } | null>(null);
  const refs = useComposedRefs(input, ref);
  const fixed = readOnly ?? (!onChange && !onValueChange);
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const latest = useRef({ characters, length, fixed, value, onValueChange });
  useLayoutEffect(() => {
    latest.current = { characters, length, fixed, value, onValueChange };
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
    // Every insert goes through the rule, typing too, so maxLength never decides where text lands.
    function onBeforeInput(event: InputEvent) {
      const { inputType } = event;
      // One the browser won't let be cancelled is read back by the change event instead, so its insert and this one don't both land.
      if (inserting.current || latest.current.fixed || event.isComposing || !event.cancelable || !inputType.startsWith('insert')) return;
      if (inputType === 'insertCompositionText' || inputType === 'insertFromComposition') return;
      const text = event.data ?? event.dataTransfer?.getData('text/plain');
      if (text == null) return;
      event.preventDefault();
      const { characters, length } = latest.current;
      const edit = editOf(el!.value, { start: el!.selectionStart ?? 0, end: el!.selectionEnd ?? 0 }, text, { characters, length });
      if (edit) put(el!, edit, inserting);
    }
    function onDrop(event: DragEvent) {
      if (latest.current.fixed || event.defaultPrevented) return;
      // Cancelling the drop also cancels the drag's deleteByDrag, so text dragged inside the field is copied, not moved.
      event.preventDefault();
      const box = nearestBox(slotsNode.current?.children, event.clientX);
      const at = box < 0 ? el!.value.length : box;
      if (activeIn(el!) !== el) el!.focus();
      const { characters, length } = latest.current;
      const edit = editOf(el!.value, { start: at, end: at }, event.dataTransfer?.getData('text/plain') ?? '', { characters, length });
      if (edit) put(el!, edit, inserting);
    }
    function onCompositionStart() {
      composition.current = { start: latest.current.value, reported: null };
      // Chromium cuts the whole commit on a full code otherwise. Set on the element, not through React, so it is gone before the first composed text lands.
      el!.removeAttribute('maxlength');
    }
    function onCompositionEnd() {
      const saved = composition.current;
      // Cleared first, so the edit below reaches onChange as an edit.
      composition.current = null;
      const { characters, length, value, onValueChange } = latest.current;
      el!.setAttribute('maxlength', String(length));
      if (!saved) return;
      const live = el!.value;
      if (value !== saved.start && value !== saved.reported) {
        // A value the product set while the person composed wins. React writes it when the live text goes, which also clears the input's undo history, so undo can't bring the dropped composition back.
        setComposing(null);
        return;
      }
      const target = reconcile(saved.start, live, { characters, length });
      if (live === target) {
        if (target !== value && target !== saved.reported) onValueChange?.(target);
      } else {
        // The input already holds the commit, so the code is reached from it with one edit, which keeps the undo history that setting the value would clear.
        put(el!, difference(live, target), inserting);
      }
      setComposing(null);
    }
    el.addEventListener('beforeinput', onBeforeInput);
    el.addEventListener('compositionstart', onCompositionStart);
    el.addEventListener('compositionend', onCompositionEnd);
    el.addEventListener('drop', onDrop, true);
    doc.addEventListener('selectionchange', sync);
    return () => {
      el.removeEventListener('beforeinput', onBeforeInput);
      el.removeEventListener('compositionstart', onCompositionStart);
      el.removeEventListener('compositionend', onCompositionEnd);
      el.removeEventListener('drop', onDrop, true);
      doc.removeEventListener('selectionchange', sync);
    };
  }, []);

  function onChangeInput(event: ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    const saved = composition.current;
    if ((event.nativeEvent as InputEvent).isComposing) {
      const next = reconcile(saved?.start ?? value, text, { characters, length });
      setComposing({ live: text, shown: next });
      // A composed text that is already a valid code, such as a whole alphanumeric code a phone keyboard composes as one word, is reported as it is typed; anything else waits for the end.
      if (next === text && next !== value) {
        if (saved) saved.reported = next;
        onChange?.(event);
        onValueChange?.(next);
      }
      sync();
      return;
    }
    setComposing(null);
    onChange?.(event);
    // The input held `value` before this change, so the change is read by the rule: autofill that skips beforeinput, an insert the browser wouldn't let be cancelled, the edit that ends a composition.
    const next = reconcile(value, text, { characters, length });
    // A change that leaves the code as it is, such as an edit that drops a refused composition, isn't reported, so a product that sends a full code doesn't send it twice.
    if (next !== value) onValueChange?.(next);
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
        maxLength={length}
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
