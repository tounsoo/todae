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
import { cleanCode, slotsOf, type CodeSelection, type OneTimeCodeCharacters } from './oneTimeCode.js';
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

/** The index of the box whose center is nearest `clientX`, or -1 without boxes. */
function nearestBox(slots: HTMLCollection | undefined, clientX: number) {
  let nearest = -1;
  let best = Infinity;
  for (const [i, slot] of [...(slots ?? [])].entries()) {
    const box = slot.getBoundingClientRect();
    const distance = Math.abs(clientX - (box.left + box.right) / 2);
    if (distance < best) {
      best = distance;
      nearest = i;
    }
  }
  return nearest;
}

// Puts `text` in the input where the person's edit would, and fires the input event that reaches `onChange`. It uses the input's own undo stack where the browser has one; elsewhere it writes the value itself.
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
  // As the browser does for a paste, keep what fits.
  const room = Math.max(input.maxLength - (input.value.length - (end - start)), 0);
  const kept = text.slice(0, room);
  // The prototype's setter, not the instance's, which React watches to tell its own writes from the person's.
  const next = input.value.slice(0, start) + kept + input.value.slice(end);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, next);
  input.setSelectionRange(start + kept.length, start + kept.length);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * A code for a sign-in or a verification, drawn as boxes over one native
 * input. The input keeps paste, undo, selection and the phone's code autofill
 * (`autocomplete="one-time-code"`), and the boxes are only drawn. Typing,
 * paste and autofill all keep the characters the code allows and cut it to
 * `length`; a pasted code replaces the whole value, a drop lands at the box it is dropped on, and a press on a box
 * selects its character so typing replaces it.
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
  const dropBox = useRef<number | null>(null);
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
    function put(text: string) {
      // A browser may fire beforeinput for the command below, which would come back here.
      inserting.current = true;
      try {
        insert(el!, text);
      } finally {
        inserting.current = false;
      }
    }
    function onBeforeInput(event: InputEvent) {
      const { characters, length, fixed } = latest.current;
      const { inputType } = event;
      const dropped = dropBox.current;
      dropBox.current = null;
      if (inserting.current || fixed || event.isComposing || !inputType.startsWith('insert') || inputType === 'insertCompositionText') return;
      const data = event.data ?? event.dataTransfer?.getData('text/plain');
      if (data == null) return;
      const clean = cleanCode(data, characters, Infinity);
      const typed = inputType === 'insertText' && data.length === 1;
      if (typed ? clean !== data : !clean) {
        event.preventDefault();
        return;
      }
      const text = clean.slice(0, length);
      const { value: current } = el!;
      let from = el!.selectionStart ?? 0;
      let to = el!.selectionEnd ?? from;
      // A browser moves the caret to the drop point on the input's own text, which means nothing for boxes.
      if (inputType === 'insertFromDrop' && dropped !== null) from = to = Math.min(dropped, current.length);
      if (!typed && clean.length >= length) {
        // A code that fills every box replaces the value.
        from = 0;
        to = current.length;
      } else if (current.length >= length && from === to) {
        // On a full code maxLength would refuse the insert, so it replaces the characters from the caret, or the last ones where they don't reach; nothing lands after the code.
        if (from >= length) {
          event.preventDefault();
          return;
        }
        from = Math.min(from, length - text.length);
        to = from + text.length;
      } else if (typed) {
        // The browser inserts a character that is allowed and replaces nothing.
        return;
      }
      event.preventDefault();
      el!.setSelectionRange(from, to);
      put(text);
    }
    // A full code has no room for a composition, so it replaces the box at the caret, as a typed character does.
    function onCompositionStart() {
      const { length, fixed } = latest.current;
      const at = el!.selectionStart ?? 0;
      if (!fixed && el!.value.length >= length && at === el!.selectionEnd && at < length) el!.setSelectionRange(at, at + 1);
    }
    function onDrop(event: DragEvent) {
      const box = nearestBox(slotsNode.current?.children, event.clientX);
      dropBox.current = box < 0 ? null : box;
    }
    el.addEventListener('beforeinput', onBeforeInput);
    el.addEventListener('compositionstart', onCompositionStart);
    el.addEventListener('drop', onDrop, true);
    doc.addEventListener('selectionchange', sync);
    return () => {
      el.removeEventListener('beforeinput', onBeforeInput);
      el.removeEventListener('compositionstart', onCompositionStart);
      el.removeEventListener('drop', onDrop, true);
      doc.removeEventListener('selectionchange', sync);
    };
  }, []);

  function onChangeInput(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event);
    // Autofill that skips beforeinput, and a composition, can bring characters the code doesn't allow.
    onValueChange?.(cleanCode(event.target.value, characters, length));
    sync();
  }

  // A press on a box selects its character, so typing replaces it; a press past the code puts the caret after it. Done on click rather than by cancelling the press, so a phone focuses natively and keeps its keyboard.
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
  const slots = slotsOf(value, selection, length);
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
        value={value}
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
            {value.charAt(i)}
          </span>
        ))}
      </span>
    </span>
  );
}
