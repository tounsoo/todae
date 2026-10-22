import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type MouseEvent,
  type Ref,
} from 'react';
import { cleanCode, slotsOf, type CodeSelection, type OneTimeCodeCharacters } from './oneTimeCode.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import styles from './Field.module.css';
import { useField } from '../hooks/useField.js';

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
  ref?: Ref<HTMLInputElement>;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'type' | 'onChange' | 'className' | 'disabled' | 'maxLength' | 'minLength' | 'pattern' | 'inputMode'
>;

function readSelection(input: HTMLInputElement | null): CodeSelection | null {
  if (!input || input.ownerDocument.activeElement !== input) return null;
  return { start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 };
}

function sameSelection(a: CodeSelection | null, b: CodeSelection | null) {
  return a === b || (a !== null && b !== null && a.start === b.start && a.end === b.end);
}

// Puts `text` in the input where the person's edit would, on the input's own undo stack. Returns false where the browser can't.
function insert(input: HTMLInputElement, text: string): boolean {
  const doc = input.ownerDocument;
  if (doc.activeElement !== input || typeof doc.execCommand !== 'function') return false;
  try {
    return doc.execCommand('insertText', false, text);
  } catch {
    return false;
  }
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
  readOnly,
  autoComplete = 'one-time-code',
  dir = 'ltr',
  ref,
  onClick: onClickProp,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  ...props
}: FieldOneTimeCodeProps) {
  const field = useField();
  const input = useRef<HTMLInputElement>(null);
  const slotsNode = useRef<HTMLSpanElement>(null);
  const refs = useComposedRefs(input, ref);
  const fixed = readOnly ?? (!onChange && !onValueChange);
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const latest = useRef({ characters, length, fixed, onValueChange });
  useLayoutEffect(() => {
    latest.current = { characters, length, fixed, onValueChange };
  });

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
    function onBeforeInput(event: InputEvent) {
      const { characters, length, fixed, onValueChange } = latest.current;
      const { inputType } = event;
      if (fixed || event.isComposing || !inputType.startsWith('insert') || inputType === 'insertCompositionText') return;
      if (inputType === 'insertText') {
        if (event.data != null && cleanCode(event.data, characters, Infinity) !== event.data) event.preventDefault();
        return;
      }
      const data = event.data ?? event.dataTransfer?.getData('text/plain');
      if (data == null) return;
      const clean = cleanCode(data, characters, Infinity);
      if (clean.length < length && clean === data) return;
      event.preventDefault();
      // A code that fills every box replaces the value, instead of landing after what is typed.
      const whole = clean.length >= length;
      const text = clean.slice(0, length);
      if (whole) el!.select();
      if (insert(el!, text)) return;
      const before = whole ? '' : el!.value.slice(0, el!.selectionStart ?? 0);
      const after = whole ? '' : el!.value.slice(el!.selectionEnd ?? 0);
      onValueChange?.(cleanCode(before + text + after, characters, length));
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
    if (event.detail > 1 || !slots?.length) return;
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
    if (nearest < value.length) target.setSelectionRange(nearest, nearest + 1);
    else target.setSelectionRange(value.length, value.length);
    sync();
  }

  const control = field.getControlProps({ ...props, ref: refs });
  const slots = slotsOf(value, selection, length);
  return (
    <span className={cx(styles.oneTimeCode, className)}>
      <input
        {...control}
        type="text"
        inputMode={characters === 'digits' ? 'numeric' : 'text'}
        autoComplete={autoComplete}
        maxLength={length}
        minLength={length}
        pattern={characters === 'digits' ? '[0-9]*' : '[A-Za-z0-9]*'}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        dir={dir}
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
      <span ref={slotsNode} className={styles.slots} aria-hidden="true" data-todae-focus-ring="">
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
