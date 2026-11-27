import {
  THEME_OVERRIDE_KEYS,
  themeOverrideStyle,
  type ThemeDurationValue,
  type ThemeOverride,
} from '@tounsoo/todae';
import { describe, expect, it } from 'vitest';
import { MOTION_CHOICES, MOTION_FEELS, PRESET_MOTION, isMotionKey, withMotion } from './motion';
import fernwayContract from '../../../../examples/fernway/tokens/contract.json';
import fernwayCore from '../../../../examples/fernway/tokens/core.json';
import { PRESETS } from './presets';

const ms = (value: number) => ({ value, unit: 'ms' }) as const;

describe('withMotion', () => {
  const base: ThemeOverride = {
    'radius.md': { value: 1, unit: 'rem' },
    'motion.duration.slow': ms(400),
    'popover.motion.scale': 0.9,
  };

  it('keeps the preset’s own motion for the preset option', () => {
    expect(withMotion(base, 'preset')).toEqual(base);
  });

  it('swaps every motion token for the feel’s and keeps the rest', () => {
    expect(withMotion(base, 'standard')).toEqual({ 'radius.md': { value: 1, unit: 'rem' } });
    const snappy = withMotion(base, 'snappy');
    expect(snappy['radius.md']).toEqual({ value: 1, unit: 'rem' });
    expect(snappy['motion.duration.slow']).not.toEqual(ms(400));
    expect(snappy['popover.motion.scale']).not.toBe(0.9);
  });
});

/** A DTCG token file's motion tokens, flattened to override keys. Fernway writes literal values, not aliases. */
function motionTokens(file: object): ThemeOverride {
  const out: Record<string, unknown> = {};
  const walk = (node: Record<string, unknown>, path: string[]) => {
    if ('$value' in node) {
      if (isMotionKey(path.join('.'))) out[path.join('.')] = node.$value;
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (!key.startsWith('$') && child && typeof child === 'object') walk(child as Record<string, unknown>, [...path, key]);
    }
  };
  walk(file as Record<string, unknown>, []);
  return out as ThemeOverride;
}

const FERNWAY = { ...motionTokens(fernwayCore), ...motionTokens(fernwayContract) };

const FEELS = [
  ...Object.entries(PRESET_MOTION).map(([id, override]) => [`preset ${id}`, override] as const),
  ...Object.entries(MOTION_FEELS).map(([id, override]) => [`picker ${id}`, override] as const),
  ['Fernway', FERNWAY] as const,
];

const KEYS = new Set<string>(THEME_OVERRIDE_KEYS);

// The enter curves that may overshoot: a popover grows and a dialog rises into a resting place.
// A toast never springs, since its neighbours move with it.
const OVERSHOOT_ALLOWED = ['popover.motion.easing.enter', 'dialog.motion.easing.enter'];

// Todae's core duration scale and what each role points at (tokens/core.json and tokens/components/motion.json).
const CORE = { fast: 160, normal: 200, moderate: 240, slow: 280, slower: 300 } as const;
type Step = keyof typeof CORE;
const ROLES: Record<string, readonly [enter: Step, exit: Step]> = {
  reveal: ['normal', 'normal'],
  popup: ['moderate', 'normal'],
  window: ['slow', 'normal'],
  panel: ['slow', 'moderate'],
  notice: ['normal', 'fast'],
};
const durationMs = (value: unknown) => {
  const { value: n, unit } = value as ThemeDurationValue;
  return unit === 's' ? n * 1000 : n;
};

describe.each(FEELS)('%s', (_name, override) => {
  const entries = Object.entries(override);

  it('sets only motion tokens Todae ships, with valid values', () => {
    for (const [key] of entries) {
      expect(KEYS.has(key), key).toBe(true);
      expect(isMotionKey(key), key).toBe(true);
    }
    expect(() => themeOverrideStyle(override)).not.toThrow();
  });

  // Hover fades, checkbox and switch changes and the tab indicator read the
  // fast and normal steps and the core curves, so a feel does not slow those
  // steps, leaves the core curves as they are, and does not set those tokens.
  it('leaves state changes as quick and plain as Todae’s', () => {
    expect(durationMs(override['motion.duration.fast'] ?? { value: 160, unit: 'ms' })).toBeLessThanOrEqual(160);
    expect(durationMs(override['motion.duration.normal'] ?? { value: 200, unit: 'ms' })).toBeLessThanOrEqual(200);
    for (const [key] of entries) expect(key, key).not.toMatch(/^(motion\.easing|selection|control|tabs|focus)\./);
  });

  it('overshoots only subtly, and only as a popover or dialog appears', () => {
    for (const [key, value] of entries) {
      if (!Array.isArray(value)) continue;
      const [, y1, , y2] = value as number[];
      const overshoots = y1! < 0 || y1! > 1 || y2! < 0 || y2! > 1;
      if (overshoots) expect(OVERSHOOT_ALLOWED, key).toContain(key);
      expect(y1!, key).toBeLessThanOrEqual(1.5);
      expect(y2!, key).toBeLessThanOrEqual(1.5);
      expect(Math.min(y1!, y2!), key).toBeGreaterThanOrEqual(0);
    }
  });

  it('never springs a toast', () => {
    for (const [key, value] of entries) {
      if (!key.startsWith('toast.motion.easing') || !Array.isArray(value)) continue;
      const [, y1, , y2] = value as readonly number[];
      for (const y of [y1!, y2!]) {
        expect(y, key).toBeGreaterThanOrEqual(0);
        expect(y, key).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the core duration scale in order, from fast to slower', () => {
    const steps = (Object.keys(CORE) as Step[]).map((step) =>
      durationMs(override[`motion.duration.${step}` as keyof ThemeOverride] ?? { value: CORE[step], unit: 'ms' }),
    );
    for (let i = 1; i < steps.length; i++) expect(steps[i], `step ${i}`).toBeGreaterThanOrEqual(steps[i - 1]!);
  });

  // ARCHITECTURE.md, Motion: an exit is as long as its enter or shorter.
  it('keeps each role’s exit as long as its enter or shorter', () => {
    const core = (step: Step) =>
      durationMs(override[`motion.duration.${step}` as keyof ThemeOverride] ?? { value: CORE[step], unit: 'ms' });
    for (const [role, [enterStep, exitStep]] of Object.entries(ROLES)) {
      const enter = override[`motion.${role}.duration.enter` as keyof ThemeOverride];
      const exit = override[`motion.${role}.duration.exit` as keyof ThemeOverride];
      expect(exit ? durationMs(exit) : core(exitStep), role).toBeLessThanOrEqual(enter ? durationMs(enter) : core(enterStep));
    }
  });

  it('keeps every duration under 0.4 s and every surface close to its size', () => {
    for (const [key, value] of entries) {
      if (key.includes('duration')) expect(durationMs(value), key).toBeLessThanOrEqual(400);
    }
    expect(override['popover.motion.scale'] ?? 0.96).toBeGreaterThanOrEqual(0.85);
    expect(override['popover.motion.scale'] ?? 0.96).toBeLessThanOrEqual(1);
  });
});

describe('motion personalities', () => {
  it('keep Graphite and the standard feel exactly as Todae ships', () => {
    expect(PRESET_MOTION.graphite).toEqual({});
    expect(MOTION_FEELS.standard).toEqual({});
  });

  it('give every preset a feel of its own', () => {
    const feels = PRESETS.map((preset) => JSON.stringify(PRESET_MOTION[preset.id]));
    expect(feels.every((f) => f !== undefined)).toBe(true);
    expect(new Set(feels).size).toBe(PRESETS.length);
  });

  it('put each preset’s motion in both of its appearances', () => {
    for (const preset of PRESETS) {
      const motion = PRESET_MOTION[preset.id];
      for (const mode of ['light', 'dark'] as const) {
        const own = Object.fromEntries(Object.entries(preset[mode]).filter(([key]) => isMotionKey(key)));
        expect(own, `${preset.id} ${mode}`).toEqual(motion);
      }
    }
  });

  it('give Fernway a feel unlike any preset or picker option', () => {
    expect(Object.keys(FERNWAY).length).toBeGreaterThan(0);
    for (const other of [...Object.values(PRESET_MOTION), ...Object.values(MOTION_FEELS)]) expect(FERNWAY).not.toEqual(other);
  });

  it('list the picker’s options with the preset’s own first, then Todae’s', () => {
    expect(MOTION_CHOICES.slice(0, 2)).toEqual(['preset', 'standard']);
    expect(new Set(MOTION_CHOICES).size).toBe(MOTION_CHOICES.length);
    expect(MOTION_CHOICES).toEqual(expect.arrayContaining(['snappy', 'calm', 'springy']));
  });
});
