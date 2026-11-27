import type { ThemeOverride } from '@tounsoo/todae';
import { describe, expect, it } from 'vitest';
import { bySurface, motionReadout, optInMotion, replayCues, slowMotion } from './replay';
import { MOTION_FEELS } from './motion';

const TODAE_ENTER = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const TODAE_EXIT = 'cubic-bezier(0.4, 0, 1, 1)';

describe('motionReadout', () => {
  it('reads Todae’s own timing through the role and core aliases', () => {
    const popover = motionReadout({}).find((row) => row.surface === 'popover');
    // popover → motion.popup → motion.duration.moderate (240) and normal (200).
    expect(popover).toEqual({
      surface: 'popover',
      enter: { duration: 240, easing: TODAE_ENTER },
      exit: { duration: 200, easing: TODAE_EXIT },
    });
  });

  it('reads the tab indicator, which moves by default, apart from the panel fade', () => {
    expect(bySurface(motionReadout({})).indicator).toEqual({ surface: 'indicator', enter: { duration: 200, easing: TODAE_ENTER }, exit: null });
  });

  it('reads a feel’s values where it sets them', () => {
    const rows = bySurface(motionReadout(MOTION_FEELS.springy));
    expect(rows.popover?.enter).toEqual({ duration: 280, easing: 'cubic-bezier(0.34, 1.36, 0.64, 1)' });
    expect(rows.dialog?.enter).toEqual({ duration: 320, easing: 'cubic-bezier(0.34, 1.36, 0.64, 1)' });
    // Toasts never spring.
    expect(rows.toast?.enter).toEqual({ duration: 300, easing: TODAE_ENTER });
  });

  it('shows the opt-in motions at 0ms until something turns them on, with no exit', () => {
    const rows = bySurface(motionReadout({}));
    for (const surface of ['tabs', 'steps', 'option', 'menu'] as const) {
      expect(rows[surface].enter.duration, surface).toBe(0);
      expect(rows[surface].exit, surface).toBeNull();
    }
  });
});

describe('slowMotion', () => {
  const slowed = (base: ThemeOverride) => bySurface(motionReadout({ ...base, ...slowMotion(base, 4) }));

  it('plays every surface four times as long, on the same curve', () => {
    const rows = slowed(MOTION_FEELS.springy);
    expect(rows.popover?.enter).toEqual({ duration: 1120, easing: 'cubic-bezier(0.34, 1.36, 0.64, 1)' });
    expect(rows.popover?.exit).toEqual({ duration: 720, easing: TODAE_EXIT });
    expect(rows.dialog?.exit?.duration).toBe(800);
    expect(rows.toast?.enter.duration).toBe(1200);
  });

  it('slows only motion, never a hover delay, and leaves 0ms at 0', () => {
    const layer = slowMotion({}, 4) as Record<string, unknown>;
    expect(layer['tooltip.delay.show']).toBeUndefined();
    expect(layer['menu.submenu.delay.show']).toBeUndefined();
    expect(layer['motion.duration.moderate']).toEqual({ value: 960, unit: 'ms' });
    expect(slowed({}).steps?.enter.duration).toBe(0);
  });

  it('adds nothing at normal speed', () => {
    expect(slowMotion(MOTION_FEELS.calm, 1)).toEqual({});
  });
});

describe('optInMotion', () => {
  it('turns on the motions that start at 0, timed by the feel', () => {
    // Snappy's reveal enters in 140ms and its fast step is 120ms.
    expect(optInMotion(MOTION_FEELS.snappy)).toEqual({
      'popover.motion.offset': { value: 0.5, unit: 'rem' },
      'tooltip.motion.offset': { value: 0.25, unit: 'rem' },
      'tabs.motion.panel.duration': { value: 140, unit: 'ms' },
      'steps.motion.duration': { value: 140, unit: 'ms' },
      'option.check.motion.duration': { value: 120, unit: 'ms' },
      'menu.item.check.motion.duration': { value: 120, unit: 'ms' },
    });
  });

  it('times them by Todae’s own steps under standard', () => {
    const rows = bySurface(motionReadout(optInMotion({})));
    expect(rows.tabs?.enter.duration).toBe(200);
    expect(rows.option?.enter.duration).toBe(160);
  });

  it('keeps a value the theme already sets', () => {
    const own: ThemeOverride = { 'steps.motion.duration': { value: 500, unit: 'ms' }, 'popover.motion.offset': { value: 0.25, unit: 'rem' } };
    const layer = optInMotion(own) as Record<string, unknown>;
    expect(layer['steps.motion.duration']).toBeUndefined();
    expect(layer['popover.motion.offset']).toBeUndefined();
    expect(layer['tabs.motion.panel.duration']).toEqual({ value: 200, unit: 'ms' });
  });
});

describe('replayCues', () => {
  it('plays the small surfaces, then the dialog, then a toast, each held at rest before it goes', () => {
    // Todae's own: popover and tip in 240, out 200; dialog in 280, out 200; toast in 200, out 160.
    // Each holds 700ms at rest, with 250ms between acts.
    expect(replayCues(motionReadout({}), 1)).toEqual([
      { at: 0, cue: 'open' },
      { at: 940, cue: 'close' },
      { at: 1390, cue: 'dialog-open' },
      { at: 2370, cue: 'dialog-close' },
      { at: 2820, cue: 'toast-show' },
      { at: 3720, cue: 'toast-dismiss' },
      { at: 4130, cue: 'done' },
    ]);
  });

  it('waits for the slowest small surface, such as an opted-in fade', () => {
    const rows = motionReadout({ 'steps.motion.duration': { value: 600, unit: 'ms' } });
    expect(replayCues(rows, 1)[1]).toEqual({ at: 1300, cue: 'close' });
  });

  it('stretches the holds and gaps with slow motion, as the durations are', () => {
    const base = {};
    const cues = replayCues(motionReadout({ ...base, ...slowMotion(base, 4) }), 4);
    expect(cues.at(-1)).toEqual({ at: 4130 * 4, cue: 'done' });
  });
});
