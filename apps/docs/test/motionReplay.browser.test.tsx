import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { userEvent } from 'vitest/browser';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { createToaster, parseThemeValue, ThemeProvider, Toast, type ThemeOverride } from '@tounsoo/todae';
import { emulateMedia } from '../../../packages/design-system/src/test/media';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { withMotion, type MotionChoice } from '../components/playground/motion';
import { MotionStage } from '../components/playground/MotionStage';
import { PRESETS } from '../components/playground/presets';

// The Playground's motion replay, on a stage like the Playground's: Play
// motion runs the popover, tip, tab panel, step and check, then a toast, and
// never the dialog, which Play dialog plays on its own. These tests read the CSS transitions that actually run, so a
// replay that plays something other than the picked feel fails here.

beforeAll(() => emulateMedia([]));

afterEach(async () => {
  cleanup();
  await emulateMedia([]);
});

const reduce = () => emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const copy = DICTIONARIES.en.motionLab;

function stageOverrides(presetId: string, choice: MotionChoice): ThemeOverride {
  const preset = PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) throw new Error(`no preset ${presetId}`);
  return withMotion(preset.light, choice);
}

function Stage({ overrides }: { overrides: ThemeOverride }) {
  const [toaster] = useState(() => createToaster());
  const [optIn, setOptIn] = useState(false);
  return (
    <ThemeProvider appearance="light" overrides={overrides} data-density="comfortable" style={{ padding: 32 }}>
      <MotionStage overrides={overrides} optIn={optIn} onOptInChange={setOptIn} toaster={toaster} copy={copy}>
        <Toast.Region toaster={toaster}>
          {(toast) => (
            <Toast.Root>
              <Toast.Title>{toast.title}</Toast.Title>
            </Toast.Root>
          )}
        </Toast.Region>
      </MotionStage>
    </ThemeProvider>
  );
}

type Ran = { property: string; duration: number; easing: string; from: string };

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/**
 * Every CSS transition that runs on `target()`, and with `subtree` inside it,
 * from now until it has been still for a few frames. A CSS animation counts
 * as `animation:<name>`.
 */
async function transitionsOn(target: () => Element | null | undefined, { subtree = false } = {}): Promise<Ran[]> {
  const seen = new Map<string, Ran>();
  const start = performance.now();
  let started = false;
  let quiet = 0;
  while (performance.now() - start < 5000) {
    await frame();
    const el = target();
    const running = el ? el.getAnimations({ subtree }) : [];
    for (const animation of running) {
      if (!(animation instanceof CSSTransition)) {
        const name = `animation:${(animation as CSSAnimation).animationName}`;
        seen.set(name, { property: name, duration: 0, easing: '', from: '' });
        continue;
      }
      const effect = animation.effect as KeyframeEffect;
      seen.set(animation.transitionProperty, {
        property: animation.transitionProperty,
        duration: Number(effect.getTiming().duration),
        easing: String(effect.getTiming().easing),
        from: String(effect.getKeyframes()[0]?.[animation.transitionProperty] ?? ''),
      });
    }
    started ||= running.length > 0;
    quiet = started && running.length === 0 ? quiet + 1 : 0;
    if (quiet > 2) break;
  }
  return [...seen.values()];
}

const byProperty = (ran: Ran[]) => Object.fromEntries(ran.map((r) => [r.property, r]));
function timing(ran: Record<string, Ran>, property: string) {
  const run = ran[property];
  expect(run, `${property} transition ran`).toBeDefined();
  return { duration: run!.duration, easing: run!.easing };
}
const MOVES = ['transform', 'translate', 'scale', 'rotate', 'top', 'bottom', 'inset-block-start', 'margin-top', 'margin-bottom', 'margin-block-start', 'margin-block-end'];

const play = () => screen.getByRole('button', { name: copy.play });
/** The popover, which is in the page only while it shows. */
const popoverEl = () => screen.queryByRole('dialog', { name: 'Popover', hidden: true });
const popoverOpen = () => popoverEl()?.matches(':popover-open') ?? false;
const tipEl = () => screen.queryByRole('tooltip', { name: copy.tip, hidden: true });
const dialogPanel = () => screen.queryByRole('dialog', { name: copy.dialogTitle })?.querySelector('[role="document"]');
const toastItem = () => screen.queryByText(copy.toast)?.closest('li');

const playDialog = () => screen.getByRole('button', { name: copy.playDialog });

/**
 * Presses Play motion, with focus on it, and reads each act's enter as it plays: the popover and
 * tip, then the toast. Meanwhile it watches every frame for focus leaving the button or a dialog showing.
 */
async function replay() {
  const button = play();
  button.focus();
  let focusLeft = false;
  let dialogShown = false;
  let watching = true;
  const watch = (async () => {
    while (watching) {
      focusLeft ||= document.activeElement !== button;
      dialogShown ||= screen.queryByRole('dialog', { name: copy.dialogTitle, hidden: true }) !== null;
      await frame();
    }
  })();
  button.click();
  await waitFor(() => expect(popoverOpen()).toBe(true));
  const [popover, tip] = (await Promise.all([transitionsOn(popoverEl), transitionsOn(tipEl)])).map(byProperty);
  await screen.findByText(copy.toast, undefined, { timeout: 5000 });
  const toast = byProperty(await transitionsOn(toastItem));
  // It plays once and stops.
  await waitFor(() => expect(screen.getByRole('button', { name: copy.play })).toBeTruthy(), { timeout: 5000 });
  await waitFor(() => expect(toastItem()).toBeFalsy(), { timeout: 5000 });
  watching = false;
  await watch;
  expect(focusLeft, 'Play motion never moves focus').toBe(false);
  expect(dialogShown, 'Play motion never opens the dialog').toBe(false);
  return { popover: popover!, tip: tip!, toast };
}

/** Presses Play dialog, with focus on it, reads the dialog's enter, and waits until it has gone. */
async function dialogReplay() {
  const button = playDialog();
  button.focus();
  button.click();
  const dialog = await screen.findByRole('dialog', { name: copy.dialogTitle }, { timeout: 5000 });
  const ran = byProperty(await transitionsOn(dialogPanel));
  // The modal holds focus while it shows.
  expect(dialog.contains(document.activeElement)).toBe(true);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: copy.dialogTitle })).toBeNull(), { timeout: 8000 });
  return ran;
}

const TODAE_ENTER = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const SPRING = 'cubic-bezier(0.34, 1.36, 0.64, 1)';
// Written out from the feels, not read from motion.ts or replay.ts.
const FEELS = [
  {
    name: 'Y2K Chrome with standard',
    preset: 'y2k-chrome',
    choice: 'standard',
    popover: { duration: 240, easing: TODAE_ENTER, growsFrom: '0.96' },
    tip: { duration: 240, easing: TODAE_ENTER },
    dialog: { duration: 280, easing: TODAE_ENTER },
    toast: { duration: 200, easing: TODAE_ENTER },
  },
  {
    name: 'Graphite with springy',
    preset: 'graphite',
    choice: 'springy',
    popover: { duration: 280, easing: SPRING, growsFrom: '0.9' },
    // Only popovers and dialogs spring; a tip takes the feel's plain enter curve.
    tip: { duration: 280, easing: TODAE_ENTER },
    dialog: { duration: 320, easing: SPRING },
    // Toasts never spring.
    toast: { duration: 300, easing: TODAE_ENTER },
  },
] as const;

describe.each(FEELS)('Play motion on $name', ({ preset, choice, popover, tip, dialog, toast }) => {
  it('plays the feel’s timing on the popover, tip and toast, with their movement, never moving focus', { timeout: 30000 }, async () => {
    render(<Stage overrides={stageOverrides(preset, choice)} />);
    const ran = await replay();
    expect(timing(ran.popover, 'opacity')).toEqual({ duration: popover.duration, easing: popover.easing });
    expect(timing(ran.popover, 'scale')).toEqual({ duration: popover.duration, easing: popover.easing });
    expect(ran.popover.scale!.from).toBe(popover.growsFrom);
    expect(timing(ran.tip, 'opacity')).toEqual(tip);
    expect(timing(ran.toast, 'opacity')).toEqual(toast);
    expect(Object.keys(ran.toast).some((p) => MOVES.includes(p)), 'the toast slides').toBe(true);
  });

  it('only fades under reduced motion, still with the feel’s timing, and says so', { timeout: 30000 }, async () => {
    await reduce();
    render(<Stage overrides={stageOverrides(preset, choice)} />);
    expect(screen.getByText(copy.reduced)).toBeTruthy();
    const ran = await replay();
    expect(Object.keys(ran.popover)).toEqual(['opacity']);
    expect(timing(ran.popover, 'opacity')).toEqual({ duration: popover.duration, easing: popover.easing });
    expect(Object.keys(ran.tip)).toEqual(['opacity']);
    expect(timing(ran.tip, 'opacity')).toEqual(tip);
    expect(Object.keys(ran.toast).filter((p) => MOVES.includes(p))).toEqual([]);
    expect(timing(ran.toast, 'opacity')).toEqual(toast);
  });

  it('plays the dialog on its own button with the feel’s timing, then gives focus back to that button', { timeout: 30000 }, async () => {
    render(<Stage overrides={stageOverrides(preset, choice)} />);
    const ran = await dialogReplay();
    expect(timing(ran, 'opacity')).toEqual(dialog);
    expect(timing(ran, 'top')).toEqual(dialog);
    await waitFor(() => expect(document.activeElement).toBe(playDialog()));
    // Only the dialog played.
    expect(screen.queryByText(copy.toast)).toBeNull();
    expect(popoverOpen()).toBe(false);
  });

  it('only fades the dialog under reduced motion, and still gives focus back', { timeout: 30000 }, async () => {
    await reduce();
    render(<Stage overrides={stageOverrides(preset, choice)} />);
    const ran = await dialogReplay();
    expect(Object.keys(ran)).toEqual(['opacity']);
    expect(timing(ran, 'opacity')).toEqual(dialog);
    await waitFor(() => expect(document.activeElement).toBe(playDialog()));
  });
});

describe('Closing the dialog', () => {
  it('with Escape closes it sooner and gives focus back to Play dialog', { timeout: 30000 }, async () => {
    render(<Stage overrides={stageOverrides('graphite', 'snappy')} />);
    await userEvent.click(playDialog());
    const dialog = await screen.findByRole('dialog', { name: copy.dialogTitle }, { timeout: 5000 });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: copy.dialogTitle })).toBeNull(), { timeout: 5000 });
    await waitFor(() => expect(document.activeElement).toBe(playDialog()));
  });
});

describe('The replay layer', () => {
  it('keeps the preset’s colors and edits on the replay and the preview, with both switches on', async () => {
    // Y2K Chrome paints its own accent; an edit to a semantic color must reach inside too.
    const overrides: ThemeOverride = { ...stageOverrides('y2k-chrome', 'standard'), 'color.fg.muted': parseThemeValue('color.fg.muted', '#123456')! };
    render(<Stage overrides={overrides} />);
    screen.getByRole('switch', { name: copy.slow }).click();
    screen.getByRole('switch', { name: copy.optIn }).click();
    await frame();
    const outer = screen.getByRole('region', { name: copy.title }).closest('[data-density]')!;
    const inside = play();
    for (const name of ['--todae-color-accent-default', '--todae-color-fg-muted', '--todae-color-bg-surface']) {
      expect(getComputedStyle(inside).getPropertyValue(name), name).toBe(getComputedStyle(outer).getPropertyValue(name));
    }
    // The edit, #123456 as Todae writes it.
    expect(getComputedStyle(inside).getPropertyValue('--todae-color-fg-muted').trim()).toBe('oklch(0.319 0.072 251.168)');
    // And the layer still slows what it wraps: Todae's popup enter is 240ms.
    expect(getComputedStyle(inside).getPropertyValue('--todae-popover-motion-duration-enter').trim()).toBe('960ms');
  });
});

describe('Slow motion', () => {
  it('plays the feel four times as long on the same curve, and Stop ends it', { timeout: 30000 }, async () => {
    render(<Stage overrides={stageOverrides('graphite', 'snappy')} />);
    screen.getByRole('switch', { name: copy.slow }).click();
    await frame();
    play().click();
    await waitFor(() => expect(popoverOpen()).toBe(true));
    const ran = byProperty(await transitionsOn(popoverEl));
    // Snappy's popup enters in 160ms.
    expect(timing(ran, 'opacity')).toEqual({ duration: 640, easing: 'cubic-bezier(0, 0, 0.2, 1)' });
    screen.getByRole('button', { name: copy.stop }).click();
    await waitFor(() => expect(popoverOpen()).toBe(false), { timeout: 5000 });
    expect(screen.queryByRole('dialog', { name: copy.dialogTitle })).toBeNull();
    await frame();
    expect(screen.getByRole('button', { name: copy.play })).toBeTruthy();
  });

  it('lists the unslowed values', async () => {
    render(<Stage overrides={stageOverrides('graphite', 'snappy')} />);
    screen.getByRole('switch', { name: copy.slow }).click();
    await frame();
    const row = screen.getByRole('table', { name: copy.readout }).querySelector('[data-surface="popover"] [data-phase="enter"]');
    expect(row?.textContent).toBe('160ms cubic-bezier(0, 0, 0.2, 1)');
  });
});

describe('Opt-in motion', () => {
  /** Turns the opt-in motions on and presses Play motion, then reads each small surface as it opens. */
  async function optInReplay(choice: MotionChoice) {
    render(<Stage overrides={stageOverrides('graphite', choice)} />);
    screen.getByRole('switch', { name: copy.optIn }).click();
    await frame();
    play().click();
    const panel = () => screen.queryAllByRole('tabpanel').find((el) => !el.hidden);
    const step = () => screen.getByRole('list', { name: copy.steps });
    const check = () => screen.getByRole('option', { name: 'Yearly' }).querySelector('[data-todae-glyph]');
    const skeleton = () => screen.getByRole('region', { name: copy.title }).querySelector('.pg-motion-skeleton > [data-variant]');
    const [popover, tip, tabs, steps, option] = await Promise.all([
      transitionsOn(popoverEl),
      transitionsOn(tipEl),
      transitionsOn(panel),
      transitionsOn(step, { subtree: true }),
      transitionsOn(check),
    ]);
    const variant = skeleton()?.getAttribute('data-variant');
    const skeletonMoves = skeleton()?.getAnimations().length ?? 0;
    screen.getByRole('button', { name: copy.stop }).click();
    return { popover: byProperty(popover), tip: byProperty(tip), tabs: byProperty(tabs), steps: byProperty(steps), option: byProperty(option), variant, skeletonMoves };
  }

  it('lists them at 0ms until turned on, then at the feel’s steps', async () => {
    render(<Stage overrides={stageOverrides('graphite', 'standard')} />);
    const enter = (surface: string) =>
      screen.getByRole('table', { name: copy.readout }).querySelector(`[data-surface="${surface}"] [data-phase="enter"]`)?.textContent;
    expect(enter('tabs')).toBe(`0ms (${copy.off})`);
    screen.getByRole('switch', { name: copy.optIn }).click();
    await frame();
    expect(enter('tabs')).toBe(`200ms ${TODAE_ENTER}`);
    expect(enter('option')).toBe(`160ms ${TODAE_ENTER}`);
    expect(enter('menu')).toBe(`160ms ${TODAE_ENTER}`);
  });

  it('slides the popover and tip, fades the tab panel and the step, grows the check, and shimmers, timed by the feel', { timeout: 30000 }, async () => {
    const ran = await optInReplay('snappy');
    // Snappy's popup enters in 160ms on its own curve. The popover slides 0.5rem and the tip 0.25rem, by layout.
    const SNAPPY = { duration: 160, easing: 'cubic-bezier(0, 0, 0.2, 1)' };
    expect(timing(ran.popover, '--_popover-slide')).toEqual(SNAPPY);
    expect(ran.popover['--_popover-slide']!.from).toBe('8px');
    expect(timing(ran.tip, '--_tooltip-slide')).toEqual(SNAPPY);
    expect(ran.tip['--_tooltip-slide']!.from).toBe('4px');
    // Snappy's reveal step is 140ms and its selection step 120ms; these read the core curve, which feels leave alone.
    expect(timing(ran.tabs, 'opacity')).toEqual({ duration: 140, easing: TODAE_ENTER });
    expect(timing(ran.steps, 'color')).toEqual({ duration: 140, easing: TODAE_ENTER });
    // A step goes from pending to done, never current, whose spinner would loop.
    expect(Object.keys(ran.steps).filter((p) => p.startsWith('animation:'))).toEqual([]);
    expect(timing(ran.option, 'opacity')).toEqual({ duration: 120, easing: TODAE_ENTER });
    expect(timing(ran.option, 'scale')).toEqual({ duration: 120, easing: TODAE_ENTER });
    expect(ran.variant).toBe('shimmer');
    expect(ran.skeletonMoves).toBeGreaterThan(0);
  });

  it('only fades them under reduced motion, and the skeleton holds still', { timeout: 30000 }, async () => {
    await reduce();
    const ran = await optInReplay('standard');
    expect(Object.keys(ran.popover)).toEqual(['opacity']);
    expect(Object.keys(ran.tip)).toEqual(['opacity']);
    expect(Object.keys(ran.tabs)).toEqual(['opacity']);
    for (const p of Object.keys(ran.steps)) expect(MOVES).not.toContain(p);
    expect(Object.keys(ran.option)).toEqual(['opacity']);
    expect(ran.skeletonMoves).toBe(0);
  });

  it('turns on the menu check in what the stage wraps', async () => {
    render(<Stage overrides={stageOverrides('graphite', 'standard')} />);
    screen.getByRole('switch', { name: copy.optIn }).click();
    await frame();
    const region = screen.getByRole('region', { name: copy.title });
    // The layer is the plain element around the replay and the preview it wraps.
    const layer = region.parentElement!;
    expect(getComputedStyle(layer).getPropertyValue('--todae-menu-item-check-motion-duration').trim()).toBe('160ms');
  });
});
