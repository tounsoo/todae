import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Button, Dialog, Popover, ThemeProvider, usePopover, type ThemeOverride } from '@tounsoo/todae';
import { emulateMedia } from '../../../packages/design-system/src/test/media';
import { withMotion, type MotionChoice } from '../components/playground/motion';
import { PRESETS } from '../components/playground/presets';

// The Playground's stage is a ThemeProvider carrying the chosen preset's light
// overrides, with its motion swapped by the Motion picker. These tests open a
// popover and a dialog on such a stage and read the CSS transitions that
// actually run, so a feel that never reaches the page fails here.

afterEach(async () => {
  cleanup();
  await emulateMedia([]);
});

function stageOverrides(presetId: string, choice: MotionChoice): ThemeOverride {
  const preset = PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) throw new Error(`no preset ${presetId}`);
  return withMotion(preset.light, choice);
}

type Ran = { property: string; duration: number; easing: string; from: string };

/** Every CSS transition that runs on `target()` from now until it has been still for a few frames. */
async function transitionsOn(target: () => Element | null): Promise<Ran[]> {
  const seen = new Map<string, Ran>();
  const start = performance.now();
  let started = false;
  let quiet = 0;
  while (performance.now() - start < 3000) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const el = target();
    const running = el ? el.getAnimations().filter((a): a is CSSTransition => 'transitionProperty' in a) : [];
    for (const transition of running) {
      const effect = transition.effect as KeyframeEffect;
      seen.set(transition.transitionProperty, {
        property: transition.transitionProperty,
        duration: Number(effect.getTiming().duration),
        easing: String(effect.getTiming().easing),
        // Where it starts: the scale a popover grows from, say.
        from: String(effect.getKeyframes()[0]?.[transition.transitionProperty] ?? ''),
      });
    }
    started ||= running.length > 0;
    quiet = started && running.length === 0 ? quiet + 1 : 0;
    if (quiet > 2) break;
  }
  return [...seen.values()];
}

function PopoverStage({ overrides }: { overrides: ThemeOverride }) {
  const popover = usePopover({ defaultOpen: true });
  return (
    <ThemeProvider appearance="light" overrides={overrides} data-density="comfortable" style={{ padding: 64 }}>
      <Button.Root {...popover.getTriggerProps()}>Open</Button.Root>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Menu">
        Body
      </Popover.Root>
    </ThemeProvider>
  );
}

function DialogStage({ overrides }: { overrides: ThemeOverride }) {
  const [open, setOpen] = useState(false);
  return (
    <ThemeProvider appearance="light" overrides={overrides} data-density="comfortable">
      <Button.Root onClick={() => setOpen(true)}>Edit</Button.Root>
      <Dialog.Root open={open} onOpenChange={setOpen} aria-label="Edit invoice">
        Body
      </Dialog.Root>
    </ThemeProvider>
  );
}

async function popoverTransitions(overrides: ThemeOverride): Promise<Ran[]> {
  render(<PopoverStage overrides={overrides} />);
  const content = screen.getByRole('dialog', { name: 'Menu' });
  await waitFor(() => expect(content.matches(':popover-open')).toBe(true));
  return transitionsOn(() => content);
}

async function dialogTransitions(overrides: ThemeOverride): Promise<Ran[]> {
  render(<DialogStage overrides={overrides} />);
  screen.getByRole('button', { name: 'Edit' }).click();
  // The panel is the dialog's content box; the backdrop fades on its own.
  return transitionsOn(() => screen.queryByRole('dialog', { name: 'Edit invoice' })?.querySelector('[class*="panel"]') ?? null);
}

const byProperty = (ran: Ran[]) => Object.fromEntries(ran.map((r) => [r.property, r]));
const timing = ({ duration, easing }: Ran) => ({ duration, easing });

// What each feel should play, written out from the feels' values rather than read from motion.ts.
const TODAE_ENTER = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const FEELS = [
  { name: 'Graphite with standard', preset: 'graphite', choice: 'standard', popover: { duration: 240, easing: TODAE_ENTER, growsFrom: '0.96' }, dialog: { duration: 280, easing: TODAE_ENTER } },
  { name: 'Graphite with snappy', preset: 'graphite', choice: 'snappy', popover: { duration: 160, easing: 'cubic-bezier(0, 0, 0.2, 1)', growsFrom: '0.98' }, dialog: { duration: 200, easing: 'cubic-bezier(0, 0, 0.2, 1)' } },
  { name: 'Acid’s own hard cut', preset: 'acid', choice: 'preset', popover: { duration: 120, easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)', growsFrom: null }, dialog: { duration: 140, easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)' } },
  { name: 'Graphite with springy', preset: 'graphite', choice: 'springy', popover: { duration: 280, easing: 'cubic-bezier(0.34, 1.36, 0.64, 1)', growsFrom: '0.9' }, dialog: { duration: 320, easing: 'cubic-bezier(0.34, 1.36, 0.64, 1)' } },
] as const;

describe.each(FEELS)('$name', ({ preset, choice, popover, dialog }) => {
  describe('with no motion preference', () => {
    it('fades the popover in with the feel’s timing, and grows it only when the feel does', async () => {
      const ran = byProperty(await popoverTransitions(stageOverrides(preset, choice)));
      expect(timing(ran.opacity!)).toEqual({ duration: popover.duration, easing: popover.easing });
      if (popover.growsFrom) {
        expect(timing(ran.scale!)).toEqual({ duration: popover.duration, easing: popover.easing });
        expect(ran.scale!.from).toBe(popover.growsFrom);
      } else {
        // Acid's popover starts at its full size: at most a transition from 1 that changes nothing.
        expect(['1', undefined]).toContain(ran.scale?.from);
      }
    });

    it('fades the dialog in with the feel’s timing, rising only when the feel moves it', async () => {
      const ran = byProperty(await dialogTransitions(stageOverrides(preset, choice)));
      expect(timing(ran.opacity!)).toEqual({ duration: dialog.duration, easing: dialog.easing });
      // Acid's dialog rises by 0, so nothing moves.
      if (preset === 'acid') expect(ran.top).toBeUndefined();
      else expect(timing(ran.top!)).toEqual({ duration: dialog.duration, easing: dialog.easing });
    });
  });

  describe('with reduced motion', () => {
    it('only fades the popover, still with the feel’s timing', async () => {
      await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      const ran = await popoverTransitions(stageOverrides(preset, choice));
      expect(ran.map((r) => r.property)).toEqual(['opacity']);
      expect(ran[0]).toMatchObject({ duration: popover.duration, easing: popover.easing });
    });

    it('only fades the dialog, which does not rise', async () => {
      await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      const ran = await dialogTransitions(stageOverrides(preset, choice));
      expect(ran.map((r) => r.property)).toEqual(['opacity']);
      expect(ran[0]).toMatchObject({ duration: dialog.duration, easing: dialog.easing });
    });
  });
});
