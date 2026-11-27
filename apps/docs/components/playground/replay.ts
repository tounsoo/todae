import catalog from '@tounsoo/todae/tokens.json';
import type { ThemeOverride } from '@tounsoo/todae';
import { isMotionKey } from './motion';

// What the Playground's motion replay reads: the timing each surface plays
// under a stage's overrides, worked out the way the CSS does, by following
// each token's alias until an override or a value is found.

type Row = { path: string; type: string; cssValue: string; ref: string | null; context: unknown };

const ROWS = new Map<string, Row>();
for (const row of (catalog as { tokens: Row[] }).tokens) {
  // Motion tokens have no density or appearance context, so the plain row is the one CSS uses.
  if (row.context === null && !ROWS.has(row.path)) ROWS.set(row.path, row);
}

/** The override or catalog value a token resolves to, following aliases. */
function resolve(path: string, overrides: ThemeOverride): unknown {
  const typed = (overrides as Record<string, unknown>)[path];
  if (typed !== undefined) return typed;
  const row = ROWS.get(path);
  if (!row) throw new Error(`no token ${path}`);
  return row.ref ? resolve(row.ref, overrides) : row.cssValue;
}

/** A duration token in ms. */
function durationOf(path: string, overrides: ThemeOverride): number {
  const value = resolve(path, overrides);
  if (typeof value === 'string') {
    const match = /^(-?[\d.]+)(ms|s)$/.exec(value.trim());
    if (!match) throw new Error(`${path} is not a duration: ${value}`);
    return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
  }
  const { value: n, unit } = value as { value: number; unit: 'ms' | 's' };
  return n * (unit === 's' ? 1000 : 1);
}

/** A cubicBezier token as the CSS `cubic-bezier()` the browser reports. */
function easingOf(path: string, overrides: ThemeOverride): string {
  const value = resolve(path, overrides);
  if (typeof value === 'string') return value.trim();
  return `cubic-bezier(${(value as readonly number[]).join(', ')})`;
}

export type Timing = { duration: number; easing: string };
export type ReadoutRow = { surface: Surface; enter: Timing; exit: Timing | null };

/** Each surface the replay plays, and the tokens its enter and exit read. */
const SURFACE_TOKENS = {
  popover: { enter: ['popover.motion.duration.enter', 'popover.motion.easing.enter'], exit: ['popover.motion.duration.exit', 'popover.motion.easing.exit'] },
  tooltip: { enter: ['tooltip.motion.duration.enter', 'tooltip.motion.easing.enter'], exit: null },
  dialog: { enter: ['dialog.motion.duration.enter', 'dialog.motion.easing.enter'], exit: ['dialog.motion.duration.exit', 'dialog.motion.easing.exit'] },
  toast: { enter: ['toast.motion.duration.enter', 'toast.motion.easing.enter'], exit: ['toast.motion.duration.exit', 'toast.motion.easing.exit'] },
  indicator: { enter: ['tabs.motion.duration', 'tabs.motion.easing'], exit: null },
  tabs: { enter: ['tabs.motion.panel.duration', 'tabs.motion.easing'], exit: null },
  steps: { enter: ['steps.motion.duration', 'steps.motion.easing'], exit: null },
  option: { enter: ['option.check.motion.duration', 'option.check.motion.easing'], exit: null },
  menu: { enter: ['menu.item.check.motion.duration', 'menu.item.check.motion.easing'], exit: null },
} as const;

export type Surface = keyof typeof SURFACE_TOKENS;
const READOUT_SURFACES = Object.keys(SURFACE_TOKENS) as Surface[];

/** Readout rows by surface. */
export function bySurface(rows: ReadoutRow[]): Record<Surface, ReadoutRow> {
  return Object.fromEntries(rows.map((row) => [row.surface, row])) as Record<Surface, ReadoutRow>;
}

function timing([duration, easing]: readonly [string, string], overrides: ThemeOverride): Timing {
  return { duration: durationOf(duration, overrides), easing: easingOf(easing, overrides) };
}

/** What each surface plays under `overrides`, in the order the readout lists them. */
export function motionReadout(overrides: ThemeOverride): ReadoutRow[] {
  return READOUT_SURFACES.map((surface) => {
    const tokens = SURFACE_TOKENS[surface];
    return { surface, enter: timing(tokens.enter, overrides), exit: tokens.exit ? timing(tokens.exit, overrides) : null };
  });
}

/**
 * The overrides that play every motion duration `factor` times as long, to lay
 * over `overrides`. Each is set from what it resolves to, so a feel slows as a
 * whole. Delays before a tip or submenu shows are not motion and stay as they are.
 */
export function slowMotion(overrides: ThemeOverride, factor: number): ThemeOverride {
  if (factor === 1) return {};
  const out: Record<string, unknown> = {};
  for (const row of ROWS.values()) {
    if (row.type !== 'duration' || !isMotionKey(row.path)) continue;
    out[row.path] = { value: durationOf(row.path, overrides) * factor, unit: 'ms' };
  }
  return out as ThemeOverride;
}

/**
 * The overrides that turn on the motions Todae ships at 0 (decision 0013), so
 * the preview shows them: popovers and cold tips slide in from their trigger,
 * a switched tab panel and a step's status fade, and a picked check grows in.
 * The fades take the feel's reveal step and the checks its selection step, as
 * hover and selection changes do. A value the theme already sets stays, even
 * 0, so the switch never hides what a theme chose.
 */
export function optInMotion(overrides: ThemeOverride): ThemeOverride {
  const ms = (path: string) => ({ value: durationOf(path, overrides), unit: 'ms' });
  const reveal = ms('motion.reveal.duration.enter');
  const selection = ms('selection.motion.duration');
  const layer: Record<string, unknown> = {
    'popover.motion.offset': { value: 0.5, unit: 'rem' },
    'tooltip.motion.offset': { value: 0.25, unit: 'rem' },
    'tabs.motion.panel.duration': reveal,
    'steps.motion.duration': reveal,
    'option.check.motion.duration': selection,
    'menu.item.check.motion.duration': selection,
  };
  const own = overrides as Record<string, unknown>;
  return Object.fromEntries(Object.entries(layer).filter(([path]) => own[path] === undefined)) as ThemeOverride;
}

export type Cue = 'open' | 'close' | 'dialog-open' | 'dialog-close' | 'toast-show' | 'toast-dismiss' | 'done';
/** One thing the replay does, `at` ms from the press. */
export type ReplayStep = { at: number; cue: Cue };

/** How long each surface rests once in, and the pause between acts, at normal speed. */
const HOLD = 700;
const GAP = 250;

/**
 * When the replay does what, in ms from the press. First the surfaces that
 * open together without taking focus (popover, tip, tab panel, step, check),
 * then the dialog alone, since a modal one makes the rest inert, then a
 * toast. `slow` stretches the rests as slow motion stretches the motion.
 */
export function replayCues(rows: ReadoutRow[], slow: number): ReplayStep[] {
  const row = bySurface(rows);
  const hold = HOLD * slow;
  const gap = GAP * slow;
  const small: Surface[] = ['popover', 'tooltip', 'indicator', 'tabs', 'steps', 'option'];
  const enter = Math.max(...small.map((s) => row[s].enter.duration));
  const exit = Math.max(...small.map((s) => row[s].exit?.duration ?? 0));
  const out: ReplayStep[] = [{ at: 0, cue: 'open' }];
  let at = enter + hold;
  out.push({ at, cue: 'close' });
  at += exit + gap;
  out.push({ at, cue: 'dialog-open' });
  at += row.dialog.enter.duration + hold;
  out.push({ at, cue: 'dialog-close' });
  at += (row.dialog.exit?.duration ?? 0) + gap;
  out.push({ at, cue: 'toast-show' });
  at += row.toast.enter.duration + hold;
  out.push({ at, cue: 'toast-dismiss' });
  at += (row.toast.exit?.duration ?? 0) + gap;
  out.push({ at, cue: 'done' });
  return out;
}
