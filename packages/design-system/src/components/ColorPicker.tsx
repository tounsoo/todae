import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useControlledValue } from '../hooks/useControlledState';
import { useStrings } from '../providers/StringsProvider';
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from './color';
import { useFieldsetState } from './Fieldset.context';
import { composeHandlers, cx } from './props';
import styles from './ColorPicker.module.css';

export type ColorPickerRootProps = {
  /** Controlled color as #rrggbb. Pass with onValueChange. */
  value?: string;
  /** Initial color as #rrggbb when uncontrolled. */
  defaultValue?: string;
  /** Fires with the new color as #rrggbb while it is dragged, keyed or typed. */
  onValueChange?: (value: string) => void;
  /** Stops every part from changing the color. Also set by a disabled Fieldset. */
  disabled?: boolean;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'defaultValue' | 'onChange'>;

export type ColorPickerAreaProps = Omit<ComponentPropsWithRef<'div'>, 'children'>;

export type ColorPickerHueProps = Omit<
  ComponentPropsWithRef<'input'>,
  'type' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'disabled'
>;

type ColorPickerContextValue = {
  hsv: Hsv;
  hex: string;
  disabled: boolean;
  change: (next: Hsv) => void;
};

const ColorPickerContext = createContext<ColorPickerContextValue | null>(null);

function usePicker(part: string): ColorPickerContextValue {
  const ctx = useContext(ColorPickerContext);
  if (!ctx) throw new Error(`ColorPicker.${part} must render inside ColorPicker.Root`);
  return ctx;
}

const BLACK = hsvToHex({ h: 0, s: 0, v: 0 });
const clamp = (n: number) => Math.min(1, Math.max(0, n));
// One arrow key moves one percent; Shift or Page Up and Down move ten.
const snap = (n: number) => clamp(Math.round(n * 100) / 100);

/**
 * The HSV for `value`. Hex alone loses the hue of a gray and the saturation
 * of black, so while `value` is still the color `last` makes, `last` wins,
 * and a gray keeps `last`'s hue.
 */
function resolveHsv(value: string, last: Hsv): Hsv {
  const hex = normalizeHex(value);
  if (hex === null || hex === hsvToHex(last)) return last;
  const next = hexToHsv(hex)!;
  if (next.v === 0) return { h: last.h, s: last.s, v: 0 };
  if (next.s === 0) return { ...next, h: last.h };
  return next;
}

function Root({
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled: disabledProp,
  className,
  children,
  ...props
}: ColorPickerRootProps) {
  const { disabled } = useFieldsetState({ disabled: disabledProp });
  const [value, setValue] = useControlledValue(valueProp, defaultValue ?? BLACK, onValueChange);
  const [last, setLast] = useState<Hsv>(() => hexToHsv(value) ?? { h: 0, s: 0, v: 0 });
  const hsv = resolveHsv(value, last);
  const change = useCallback(
    (next: Hsv) => {
      setLast(next);
      setValue(hsvToHex(next));
    },
    [setValue],
  );
  const ctx = useMemo(() => ({ hsv, hex: hsvToHex(hsv), disabled, change }), [hsv, disabled, change]);
  return (
    <ColorPickerContext.Provider value={ctx}>
      <div
        {...props}
        role="group"
        data-disabled={disabled ? '' : undefined}
        className={cx(styles.root, className)}
      >
        {children}
      </div>
    </ColorPickerContext.Provider>
  );
}

/**
 * Saturation runs left to right and brightness bottom to top. Two native
 * range inputs carry the values for keys and screen readers: Left and Right
 * change saturation, Up and Down brightness, and focus follows the one that
 * changed. Only the saturation input is a Tab stop.
 */
function Area({ className, style, onPointerDown, onPointerMove, ...props }: ColorPickerAreaProps) {
  const picker = usePicker('Area');
  const strings = useStrings();
  const xRef = useRef<HTMLInputElement>(null);
  const yRef = useRef<HTMLInputElement>(null);
  const { hsv, change, disabled } = picker;
  const saturation = Math.round(hsv.s * 100);
  const brightness = Math.round(hsv.v * 100);

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    change({
      h: hsv.h,
      s: clamp((event.clientX - rect.left) / rect.width),
      v: clamp(1 - (event.clientY - rect.top) / rect.height),
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 0.1 : 0.01;
    let next: Hsv;
    let axis = xRef;
    switch (event.key) {
      case 'ArrowLeft':
        next = { ...hsv, s: snap(hsv.s - step) };
        break;
      case 'ArrowRight':
        next = { ...hsv, s: snap(hsv.s + step) };
        break;
      case 'ArrowUp':
      case 'PageUp':
        next = { ...hsv, v: snap(hsv.v + (event.key === 'PageUp' ? 0.1 : step)) };
        axis = yRef;
        break;
      case 'ArrowDown':
      case 'PageDown':
        next = { ...hsv, v: snap(hsv.v - (event.key === 'PageDown' ? 0.1 : step)) };
        axis = yRef;
        break;
      default:
        return;
    }
    event.preventDefault();
    change(next);
    if (event.currentTarget !== axis.current) axis.current?.focus();
  };

  return (
    <div
      {...props}
      className={cx(styles.area, className)}
      data-disabled={disabled ? '' : undefined}
      style={
        {
          ...style,
          '--_hue': hsv.h,
          '--_x': hsv.s,
          '--_y': hsv.v,
          '--_color': picker.hex,
        } as CSSProperties
      }
      onPointerDown={composeHandlers(onPointerDown, (event: PointerEvent<HTMLDivElement>) => {
        if (disabled || event.button !== 0) return;
        // Keep focus off the area itself; it moves to the saturation input.
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        moveTo(event);
        xRef.current?.focus({ preventScroll: true });
      })}
      onPointerMove={composeHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
        if (!disabled && event.currentTarget.hasPointerCapture?.(event.pointerId)) moveTo(event);
      })}
    >
      <input
        ref={xRef}
        type="range"
        className={styles.axis}
        min={0}
        max={100}
        step={1}
        value={saturation}
        disabled={disabled}
        aria-label={strings.saturation}
        aria-valuetext={`${saturation}%`}
        onChange={(event) => change({ ...hsv, s: Number(event.target.value) / 100 })}
        onKeyDown={onKeyDown}
      />
      <input
        ref={yRef}
        type="range"
        className={styles.axis}
        min={0}
        max={100}
        step={1}
        value={brightness}
        disabled={disabled}
        tabIndex={-1}
        aria-label={strings.brightness}
        aria-valuetext={`${brightness}%`}
        onChange={(event) => change({ ...hsv, v: Number(event.target.value) / 100 })}
        onKeyDown={onKeyDown}
      />
      <span className={styles.thumb} aria-hidden="true" />
    </div>
  );
}

/** A native range input over the hues, 0 to 359 degrees. */
function Hue({ className, style, onChange, ...props }: ColorPickerHueProps) {
  const picker = usePicker('Hue');
  const strings = useStrings();
  const { hsv, change, disabled } = picker;
  const hue = Math.round(hsv.h) % 360;
  return (
    <input
      aria-label={strings.hue}
      aria-valuetext={`${hue}°`}
      {...props}
      type="range"
      min={0}
      max={359}
      step={1}
      value={hue}
      disabled={disabled}
      className={cx(styles.hue, className)}
      style={{ ...style, '--_hue': hue } as CSSProperties}
      onChange={(event) => {
        onChange?.(event);
        change({ ...hsv, h: Number(event.target.value) });
      }}
    />
  );
}

export const ColorPicker = { Root, Area, Hue } as const;
