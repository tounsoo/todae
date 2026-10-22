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
  /** Optional: `onValueChange` alone is enough when the event is not needed. */
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
 * `length`; a pasted code replaces the whole value, and a press on a box
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
      if (inserting.current || fixed || event.isComposing || !inputType.startsWith('insert') || inputType === 'insertCompositionText') return;
      const data = event.data ?? event.dataTransfer?.getData('text/plain');
      if (data == null) return;
      const clean = cleanCode(data, characters, Infinity);
      const typed = inputType === 'insertText' && data.length === 1;
      // A key, or a one-character insert from a keyboard.
      if (typed && clean !== data) {
        event.preventDefault();
        return;
      }
      if (!typed && !clean) {
        event.preventDefault();
        return;
      }
      // A code that fills every box replaces the value, instead of landing after what is typed.
      const whole = !typed && clean.length >= length;
      const text = clean.slice(0, length);
      const { value: current, selectionStart: from, selectionEnd: to } = el!;
      // On a full code the length limit would refuse the insert, so it replaces the characters from the caret, or the last ones where they don't reach.
      const replacing = !whole && current.length >= length && from === to;
      // A drop lands natively at the drop point, which has no meaning for boxes, so it is a paste at the caret.
      if (!whole && !replacing && inputType !== 'insertFromDrop' && clean === data) return;
      event.preventDefault();
      if (whole) el!.select();
      else if (replacing) {
        const at = Math.min(from ?? 0, length - text.length);
        el!.setSelectionRange(at, at + text.length);
      }
      put(text);
    }
    el.addEventListener('beforeinput', onBeforeInput);
    doc.addEventListener('selectionchange', sync);
    return () => {
      el.removeEventListener('beforeinput', onBeforeInput);
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
    const slots = slotsNode.current?.children;
    // Only a press: a label's click and an assistive technology's carry no position of the person's.
    if (event.detail !== 1 || !slots?.length) return;
    let nearest = 0;
    let best = Infinity;
    for (const [i, slot] of [...slots].entries()) {
      const box = slot.getBoundingClientRect();
      const distance = Math.abs(event.clientX - (box.left + box.right) / 2);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    }
    const target = event.currentTarget;
    // The press collapsed the caret, so a range is a drag or a Shift+click that selected on purpose.
    if (target.selectionStart !== target.selectionEnd) return;
    if (nearest < value.length) target.setSelectionRange(nearest, nearest + 1);
    else target.setSelectionRange(value.length, value.length);
    sync();
  }

  const control = field.getControlProps({ ...props, ref: refs });
  const slots = slotsOf(value, selection, length);
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
      <span ref={slotsNode} className={styles.slots} data-todae-focus-ring="" aria-hidden="true">
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
