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
import { flushSync } from 'react-dom';
import { activeIn } from './activeElement.js';
import { applyEdit, cleanCode, editOf, slotsOf, type CodeSelection, type OneTimeCodeCharacters } from './oneTimeCode.js';
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
      if (doc.execCommand('insertText', false, text)) return;
    } catch {
      // Fall through to the written edit.
    }
  }
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  write(input, input.value.slice(0, start) + text + input.value.slice(end), start + text.length);
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
  // The value and selection a composition started from, which it is applied to when it ends.
  const composition = useRef<{ value: string; selection: CodeSelection } | null>(null);
  // While composing, the input's own text, and the code the boxes show: the composition applied by the rule.
  const [composing, setComposing] = useState<{ live: string; shown: string } | null>(null);
  const refs = useComposedRefs(input, ref);
  const fixed = readOnly ?? (!onChange && !onValueChange);
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const latest = useRef({ characters, length, fixed });
  useLayoutEffect(() => {
    latest.current = { characters, length, fixed };
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
    function apply(text: string, selection: CodeSelection) {
      const { characters, length } = latest.current;
      const edit = editOf(el!.value, selection, text, { characters, length });
      if (!edit) return;
      el!.setSelectionRange(edit.from, edit.to);
      // A browser may fire beforeinput for the command insert uses, which would come back here.
      inserting.current = true;
      try {
        insert(el!, edit.insert);
      } finally {
        inserting.current = false;
      }
    }
    // Every insert goes through the rule, typing too, so maxLength never decides where text lands.
    function onBeforeInput(event: InputEvent) {
      const { inputType } = event;
      if (inserting.current || latest.current.fixed || event.isComposing || !inputType.startsWith('insert')) return;
      if (inputType === 'insertCompositionText' || inputType === 'insertFromComposition') return;
      const text = event.data ?? event.dataTransfer?.getData('text/plain');
      if (text == null) return;
      event.preventDefault();
      apply(text, { start: el!.selectionStart ?? 0, end: el!.selectionEnd ?? 0 });
    }
    function onDrop(event: DragEvent) {
      if (latest.current.fixed) return;
      // Cancelling the drop also cancels the drag's deleteByDrag, so text dragged inside the field is copied, not moved.
      event.preventDefault();
      const box = nearestBox(slotsNode.current?.children, event.clientX);
      const at = box < 0 ? el!.value.length : box;
      if (activeIn(el!) !== el) el!.focus();
      apply(event.dataTransfer?.getData('text/plain') ?? '', { start: at, end: at });
    }
    function onCompositionStart() {
      composition.current = { value: el!.value, selection: { start: el!.selectionStart ?? 0, end: el!.selectionEnd ?? 0 } };
    }
    function onCompositionEnd(event: CompositionEvent) {
      const saved = composition.current;
      composition.current = null;
      // Hands the input back to `value` now, which puts back the text from before the composition.
      flushSync(() => setComposing(null));
      const { characters, length, fixed } = latest.current;
      const edit = saved && !fixed ? editOf(saved.value, saved.selection, event.data ?? '', { characters, length }) : null;
      if (edit) {
        write(el!, applyEdit(saved!.value, edit), edit.from + edit.insert.length);
      } else if (saved && el!.value === saved.value) {
        el!.setSelectionRange(saved.selection.start, saved.selection.end);
      }
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
    const saved = composition.current;
    if ((event.nativeEvent as InputEvent).isComposing) {
      // React writes `value` back after a change event, and a write ends the composition, so the input keeps its own text until the composition ends and is applied.
      const live = event.target.value;
      let shown = saved?.value ?? value;
      if (saved) {
        const after = saved.value.length - saved.selection.end;
        const text = live.slice(saved.selection.start, Math.max(live.length - after, saved.selection.start));
        const edit = editOf(saved.value, saved.selection, text, { characters, length });
        if (edit) shown = applyEdit(saved.value, edit);
      }
      setComposing({ live, shown });
      sync();
      return;
    }
    setComposing(null);
    onChange?.(event);
    // Autofill that skips beforeinput can bring characters the code doesn't allow.
    onValueChange?.(cleanCode(event.target.value, characters, length));
    sync();
  }

  // A press on a box selects its character, so typing replaces it; a press on an empty box or past the last one puts the caret after the code. Done on click rather than by cancelling the press, so a phone focuses natively and keeps its keyboard.
  function onClick(event: MouseEvent<HTMLInputElement>) {
    const nearest = nearestBox(slotsNode.current?.children, event.clientX);
    // Only a press: a label's click and an assistive technology's carry no position of the person's.
    if (event.detail !== 1 || nearest < 0) return;
    const target = event.currentTarget;
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
