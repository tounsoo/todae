/** The start and end of a range, in that order. The two numbers may be equal. */
export type SliderRangeValue = [start: number, end: number];

export type SliderScale = {
  min: number;
  max: number;
  step: number | 'any';
};

export type SliderThumb = 'start' | 'end';

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
const DEFAULT_STEP = 1;

function blank(value: number | string | undefined): value is undefined | '' {
  return value === undefined || value === '';
}

function finiteNumber(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(value);
  const scientific = /^[+-]?\d+(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (scientific) {
    const fraction = scientific[1]?.length ?? 0;
    const places = fraction - Number(scientific[2]);
    return places > 0 ? places : 0;
  }
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

export function readScale(bounds: {
  min?: number | string;
  max?: number | string;
  step?: number | string;
} = {}): SliderScale {
  const min = blank(bounds.min) ? DEFAULT_MIN : (finiteNumber(bounds.min) ?? DEFAULT_MIN);
  let max = blank(bounds.max) ? DEFAULT_MAX : (finiteNumber(bounds.max) ?? DEFAULT_MAX);
  if (min > max) max = min;
  const raw = bounds.step;
  if (blank(raw)) return { min, max, step: DEFAULT_STEP };
  if (raw === 'any') return { min, max, step: 'any' };
  const step = finiteNumber(raw);
  return { min, max, step: step != null && step > 0 ? step : DEFAULT_STEP };
}

export function snap(value: number, scale: SliderScale): number {
  const { min, max, step } = scale;
  const fallback = min + (max - min) / 2;
  let next = Number.isFinite(value) ? value : fallback;
  if (next < min) next = min;
  else if (next > max) next = max;
  if (step === 'any') return next;
  const places = Math.max(decimalPlaces(step), decimalPlaces(min));
  const factor = 10 ** places;
  if (!Number.isFinite(factor)) return next;
  const minUnits = Math.round(min * factor);
  const stepUnits = Math.round(step * factor);
  const maxUnits = Math.round(max * factor);
  if (stepUnits <= 0) return next;
  let count = Math.round((Math.round(next * factor) - minUnits) / stepUnits);
  let snapped = minUnits + count * stepUnits;
  if (snapped > maxUnits) {
    count = Math.floor((maxUnits - minUnits) / stepUnits);
    snapped = minUnits + count * stepUnits;
  }
  if (snapped < minUnits) snapped = minUnits;
  return snapped / factor;
}

export function normalizeRange(value: readonly [number, number], scale: SliderScale): SliderRangeValue {
  const start = snap(value[0], scale);
  const snappedEnd = snap(value[1], scale);
  const end = start > snappedEnd ? start : snappedEnd;
  if (start === value[0] && end === value[1]) return value as SliderRangeValue;
  return [start, end];
}

export function moveThumb(
  value: readonly [number, number],
  thumb: SliderThumb,
  next: number,
  scale: SliderScale,
): SliderRangeValue {
  const snapped = snap(next, scale);
  if (thumb === 'start') {
    const start = Math.min(snapped, value[1]);
    if (start === value[0]) return value as SliderRangeValue;
    return [start, value[1]];
  }
  const end = Math.max(snapped, value[0]);
  if (end === value[1]) return value as SliderRangeValue;
  return [value[0], end];
}

export function nearestThumb(value: readonly [number, number], at: number): SliderThumb {
  const startDistance = Math.abs(at - value[0]);
  const endDistance = Math.abs(at - value[1]);
  if (startDistance < endDistance) return 'start';
  if (endDistance < startDistance) return 'end';
  const meeting = value[0] === value[1] ? value[0] : (value[0] + value[1]) / 2;
  return at < meeting ? 'start' : 'end';
}

export function valueFromPointer(
  clientX: number,
  rect: { left: number; width: number },
  direction: 'ltr' | 'rtl',
  scale: SliderScale,
  inset: number,
): number {
  const { width } = rect;
  const pad = Number.isFinite(inset) && inset > 0 ? inset : 0;
  const travel = width - pad * 2;
  if (!(travel > 0) || !Number.isFinite(clientX)) return scale.min;
  const fromStart = direction === 'rtl' ? rect.left + width - pad - clientX : clientX - rect.left - pad;
  const ratio = Math.min(1, Math.max(0, fromStart / travel));
  return scale.min + ratio * (scale.max - scale.min);
}

export function rangePercents(value: readonly [number, number], scale: SliderScale): { start: number; end: number } {
  const span = scale.max - scale.min;
  if (span === 0) return { start: 0, end: 0 };
  const percent = (point: number) => ((point - scale.min) / span) * 100;
  return { start: percent(value[0]), end: percent(value[1]) };
}
