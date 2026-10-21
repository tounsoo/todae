import {
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithRef,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useFieldContext, useStepper } from './Field.context.js';
import { useButtonName } from './buttonName.js';
import { MinusGlyph, PlusGlyph, glyphOr } from './glyphs.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import styles from './Field.module.css';
import { warnOnce } from './warnOnce.js';
import { tokenMs } from '../overlay/cssTime.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings } from '../providers/StringsProvider.js';

export type FieldStepButtonProps = Omit<ComponentPropsWithRef<'button'>, 'type'>;
export type FieldIncrementProps = FieldStepButtonProps;
export type FieldDecrementProps = FieldStepButtonProps;

// For when the repeat tokens can't be read, such as without Todae's stylesheet.
const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 60;

function StepButton({
  direction,
  label,
  glyph,
  className,
  children,
  'aria-label': ariaLabel,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onMouseDown,
  onClick,
  onBlur,
  disabled: disabledProp,
  ref,
  ...props
}: FieldStepButtonProps & { direction: 1 | -1; label: (field: string) => string; glyph: ReactNode }) {
  const { store } = useFieldContext();
  const stepper = useStepper(store);
  // Several number fields have the same two buttons, so the name Todae gives them says whose.
  const [name, labelRefs] = useButtonName(children, ariaLabel, ref, label(stepper?.label ?? ''));
  const node = useRef<HTMLButtonElement>(null);
  const refs = useComposedRefs(node, labelRefs);
  const timers = useRef<{ delay?: number; repeat?: number }>({});
  const stop = useCallback(() => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.repeat);
    timers.current = {};
  }, []);
  const disabled =
    Boolean(disabledProp) || !stepper || stepper.disabled || (direction > 0 ? stepper.atMax : stepper.atMin);
  // A button that turns disabled under a held press, at the bound, gets no pointer end.
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);
  useEffect(() => stop, [stop]);
  // Once on mount, after the layout effects in which a Field.NumberInput registers, even one that follows this button.
  useEffect(() => {
    if (!store.stepper) warnOnce('step-button', 'Field.Increment and Field.Decrement have no Field.NumberInput in their Field.Root');
  }, [store]);

  function press(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || disabled || !stepper) return;
    // The input keeps focus, so a press commits nothing early and opens no phone keyboard.
    event.preventDefault();
    stepper.step(direction);
    stop();
    const delay = tokenMs(node.current, '--todae-field-stepper-repeat-delay') ?? REPEAT_DELAY_MS;
    const interval = tokenMs(node.current, '--todae-field-stepper-repeat-interval') ?? REPEAT_INTERVAL_MS;
    timers.current.delay = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => store.stepper?.step(direction), interval);
    }, delay);
  }

  return (
    <button
      {...props}
      ref={refs}
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-label={name}
      aria-controls={stepper?.inputId}
      className={cx(styles.stepButton, className)}
      onPointerDown={composeHandlers(onPointerDown, press)}
      onPointerUp={composeHandlers(onPointerUp, stop)}
      onPointerLeave={composeHandlers(onPointerLeave, stop)}
      onPointerCancel={composeHandlers(onPointerCancel, stop)}
      // The browser focuses a pressed button on mousedown.
      onMouseDown={composeHandlers(onMouseDown, (event: MouseEvent<HTMLButtonElement>) => event.preventDefault())}
      // A key or assistive technology clicks with no press (detail 0): one step. A press has stepped already.
      onClick={composeHandlers(onClick, (event: MouseEvent<HTMLButtonElement>) => {
        if (event.detail === 0) stepper?.step(direction);
      })}
      onBlur={(event) => {
        onBlur?.(event);
        stop();
      }}
    >
      {children ?? (
        <span className={styles.stepGlyph} data-todae-glyph="" aria-hidden="true">
          {glyph}
        </span>
      )}
    </button>
  );
}

/**
 * Raises the number of the field's Field.NumberInput by its step. It is not a
 * tab stop and keeps focus in the input, and holding it repeats. It is named
 * from the increment string unless its own text names it; content replaces the
 * plus sign, which the plus glyph of GlyphsProvider replaces.
 */
export function Increment(props: FieldIncrementProps) {
  const strings = useStrings();
  const { plus } = useGlyphs();
  return <StepButton {...props} direction={1} label={strings.increment} glyph={glyphOr(plus, <PlusGlyph />)} />;
}

/** Lowers the number of the field's Field.NumberInput by its step, as Field.Increment raises it. Named from the decrement string, drawn with the minus glyph. */
export function Decrement(props: FieldDecrementProps) {
  const strings = useStrings();
  const { minus } = useGlyphs();
  return <StepButton {...props} direction={-1} label={strings.decrement} glyph={glyphOr(minus, <MinusGlyph />)} />;
}
