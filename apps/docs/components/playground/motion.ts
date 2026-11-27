import type { ThemeCubicBezierValue, ThemeOverride } from '@tounsoo/todae';

// Motion feels, made only from motion tokens Todae already ships. A feel
// retimes the five motion roles and the slower steps of the core duration
// scale, sets the curves of the things that appear and go, and sets how far a
// popover grows and a dialog or toast travels. It leaves the core curves and
// the fast and normal steps alone or shorter, since hover fades, checkbox and
// switch changes and the tab indicator read them. Overshoot goes on the enter
// curve of a popover or dialog, never a toast, whose neighbours move with it.
// Under prefers-reduced-motion Todae's CSS still drops each slide, rise and
// grow, so there a feel changes how long fades take and nothing more.

const ms = (value: number) => ({ value, unit: 'ms' }) as const;
const rem = (value: number) => ({ value, unit: 'rem' }) as const;

type Feel = {
  /** Core `motion.duration.fast` and `normal`. Hover, selection and tab changes read them, so a feel may only shorten them. */
  fast?: number;
  normal?: number;
  /** The rest of the core scale. */
  moderate?: number;
  slow?: number;
  slower?: number;
  /** Enter and exit ms for each role it retimes. */
  roles?: Partial<Record<'reveal' | 'popup' | 'window' | 'panel' | 'notice', readonly [enter: number, exit: number]>>;
  /** The enter and exit curves of every surface that appears and goes. */
  enter?: ThemeCubicBezierValue;
  exit?: ThemeCubicBezierValue;
  /** Enter curve for popovers and dialogs, where a slight overshoot may land. */
  surfaceEnter?: ThemeCubicBezierValue;
  /** How small a popover starts, 1 for no grow. */
  popoverScale?: number;
  /** How far a dialog rises and a toast slides, in rem. */
  dialogOffset?: number;
  toastOffset?: number;
};

/** A feel as ThemeProvider overrides. */
function feel(f: Feel): ThemeOverride {
  const out: Record<string, unknown> = {};
  const core = { fast: f.fast, normal: f.normal, moderate: f.moderate, slow: f.slow, slower: f.slower };
  for (const [step, value] of Object.entries(core)) if (value !== undefined) out[`motion.duration.${step}`] = ms(value);
  for (const [role, [enter, exit]] of Object.entries(f.roles ?? {})) {
    out[`motion.${role}.duration.enter`] = ms(enter);
    out[`motion.${role}.duration.exit`] = ms(exit);
  }
  for (const key of APPEARING.enter) if (f.enter) out[key] = f.enter;
  for (const key of APPEARING.exit) if (f.exit) out[key] = f.exit;
  if (f.surfaceEnter) {
    for (const surface of SURFACES) out[`${surface}.motion.easing.enter`] = f.surfaceEnter;
  }
  if (f.popoverScale !== undefined) out['popover.motion.scale'] = f.popoverScale;
  if (f.dialogOffset !== undefined) out['dialog.motion.offset'] = rem(f.dialogOffset);
  if (f.toastOffset !== undefined) out['toast.motion.offset'] = rem(f.toastOffset);
  return out as ThemeOverride;
}

/**
 * The surfaces whose enter curve may overshoot: a popover grows and a dialog rises into a resting
 * place. Not a toast: the toasts beside it move by the same curve, so they would bounce too.
 */
const SURFACES = ['popover', 'dialog'] as const;

/**
 * The curve of each thing that appears and goes. They all alias the core curves,
 * which state changes read too, so a feel sets these instead.
 */
const APPEARING = {
  enter: [
    'alert',
    'coachmark',
    'conversation',
    'dialog',
    'disclosure',
    'drawer',
    'drilldown',
    'field.error',
    'message.actions',
    'nav',
    'popover',
    'sheet',
    'toast',
    'tooltip',
    'tree',
  ].map((part) => `${part}.motion.easing.enter`),
  exit: [
    'coachmark',
    'conversation',
    'dialog',
    'disclosure',
    'drawer',
    'drilldown',
    'message.actions',
    'nav',
    'popover',
    'sheet',
    'toast',
    'tree',
  ].map((part) => `${part}.motion.easing.exit`),
};

export type PresetId = 'graphite' | 'porcelain' | 'acid' | 'bloom' | 'riso' | 'y2k-chrome' | 'anvil';

// Each preset's own motion. Graphite keeps Todae's.
export const PRESET_MOTION: Record<PresetId, ThemeOverride> = {
  graphite: {},
  // Quiet: barely any travel, a long smooth settle, nothing pops.
  porcelain: feel({
    moderate: 260,
    slow: 320,
    slower: 340,
    roles: { reveal: [240, 200], popup: [260, 200], window: [320, 220], panel: [320, 260], notice: [260, 200] },
    enter: [0.25, 1, 0.5, 1],
    exit: [0.5, 0, 0.75, 0],
    popoverScale: 0.99,
    dialogOffset: 0.25,
    toastOffset: 0.25,
  }),
  // Hard cut: near instant, no grow and no rise, like a terminal.
  acid: feel({
    fast: 90,
    normal: 110,
    moderate: 120,
    slow: 140,
    slower: 160,
    roles: { reveal: [110, 90], popup: [120, 90], window: [140, 110], panel: [160, 120], notice: [110, 90] },
    enter: [0.1, 0.9, 0.2, 1],
    exit: [0.5, 0, 1, 1],
    popoverScale: 1,
    dialogOffset: 0,
    toastOffset: 0,
  }),
  // Soft float: unhurried and airy, surfaces drift up and settle.
  bloom: feel({
    moderate: 300,
    slow: 360,
    slower: 400,
    roles: { reveal: [260, 220], popup: [300, 220], window: [360, 240], panel: [360, 280], notice: [300, 200] },
    enter: [0.22, 1, 0.36, 1],
    popoverScale: 0.94,
    dialogOffset: 1,
    toastOffset: 0.75,
  }),
  // Press feed: a firm ease-in-out with long travel, like paper pulled through a drum.
  riso: feel({
    moderate: 260,
    slow: 300,
    slower: 340,
    roles: { popup: [260, 200], window: [300, 220], panel: [300, 240], notice: [260, 180] },
    enter: [0.6, 0, 0.2, 1],
    exit: [0.7, 0, 0.84, 0],
    popoverScale: 0.98,
    dialogOffset: 1.25,
    toastOffset: 1,
  }),
  // Pop: surfaces spring past their place and settle back.
  'y2k-chrome': feel({
    moderate: 280,
    slow: 320,
    slower: 360,
    roles: { popup: [280, 180], window: [320, 200], notice: [300, 160] },
    surfaceEnter: [0.3, 1.4, 0.5, 1],
    popoverScale: 0.85,
    dialogOffset: 1,
    toastOffset: 1,
  }),
  // Brisk: plain product motion, a step quicker than Todae and decisive.
  anvil: feel({
    fast: 120,
    normal: 150,
    moderate: 180,
    slow: 220,
    slower: 240,
    roles: { reveal: [150, 150], popup: [180, 150], window: [220, 150], panel: [220, 180], notice: [150, 120] },
    enter: [0, 0, 0.2, 1],
    popoverScale: 0.98,
  }),
};

/** The Motion picker. `preset` keeps the chosen preset's own motion; each other feel replaces it. */
export type MotionFeelId = 'standard' | 'snappy' | 'calm' | 'springy';
export const MOTION_FEELS: Record<MotionFeelId, ThemeOverride> = {
  standard: {},
  snappy: feel({
    fast: 120,
    normal: 140,
    moderate: 160,
    slow: 200,
    slower: 220,
    roles: { reveal: [140, 120], popup: [160, 120], window: [200, 140], panel: [200, 160], notice: [140, 120] },
    enter: [0, 0, 0.2, 1],
    popoverScale: 0.98,
    dialogOffset: 0.25,
    toastOffset: 0.25,
  }),
  calm: feel({
    moderate: 300,
    slow: 360,
    slower: 400,
    roles: { reveal: [260, 220], popup: [300, 220], window: [380, 260], panel: [380, 300], notice: [300, 220] },
    enter: [0.16, 1, 0.3, 1],
    exit: [0.5, 0, 0.75, 0],
    popoverScale: 0.97,
    dialogOffset: 0.75,
  }),
  springy: feel({
    moderate: 280,
    slow: 320,
    slower: 360,
    roles: { popup: [280, 180], window: [320, 200], notice: [300, 160] },
    surfaceEnter: [0.34, 1.36, 0.64, 1],
    popoverScale: 0.9,
    dialogOffset: 1,
    toastOffset: 0.75,
  }),
};

export type MotionChoice = 'preset' | MotionFeelId;
/** The picker's options in order. A new feel added to MOTION_FEELS shows up here. */
export const MOTION_CHOICES = ['preset', ...(Object.keys(MOTION_FEELS) as MotionFeelId[])] as const;

/** Whether a token is a motion token: the core scale and roles, or a component's `*.motion.*`. */
export function isMotionKey(key: string): boolean {
  return key.startsWith('motion.') || key.includes('.motion.');
}

/** `override` with its motion tokens swapped for a feel's, or as it is for `preset`. */
export function withMotion(override: ThemeOverride, choice: MotionChoice): ThemeOverride {
  if (choice === 'preset') return override;
  const rest = Object.fromEntries(Object.entries(override).filter(([key]) => !isMotionKey(key)));
  return { ...rest, ...MOTION_FEELS[choice] } as ThemeOverride;
}
