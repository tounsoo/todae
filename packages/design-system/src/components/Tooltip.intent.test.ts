import { describe, expect, it } from 'vitest';
import {
  createIntent,
  step,
  wantsOpen,
  type TooltipCommand,
  type TooltipEvent,
  type TooltipIntentState,
  type TooltipPolicy,
} from './Tooltip.intent.js';

const fine: TooltipPolicy = { fidelity: 'fine', showDelayMs: 300, hideDelayMs: 100 };
const coarse: TooltipPolicy = { fidelity: 'coarse', showDelayMs: 300, hideDelayMs: 100 };

const acquireHover: TooltipEvent = { kind: 'acquire', hold: 'hover', reason: 'hover' };
const acquireBridge: TooltipEvent = { kind: 'acquire', hold: 'hover', reason: 'hover-bridge' };
const acquireFocus: TooltipEvent = { kind: 'acquire', hold: 'focus', reason: 'focus' };
const releaseHover: TooltipEvent = { kind: 'release', hold: 'hover' };
const releaseBridge: TooltipEvent = { kind: 'release', hold: 'hover', reason: 'hover-bridge' };
const releaseFocus: TooltipEvent = { kind: 'release', hold: 'focus' };

function run(
  event: TooltipEvent,
  ctx: {
    state?: TooltipIntentState;
    open?: boolean;
    policy?: TooltipPolicy;
    restoreFocus?: boolean;
  } = {},
) {
  return step({
    policy: ctx.policy ?? fine,
    state: ctx.state ?? createIntent(),
    open: ctx.open ?? false,
    event,
    restoreFocus: ctx.restoreFocus ?? false,
  });
}

function commitsOf(commands: readonly TooltipCommand[]) {
  return commands.filter((command) => command.kind === 'commit');
}

function delaysOf(commands: readonly TooltipCommand[]) {
  return commands.filter((command) => command.kind === 'start-delay');
}

describe('Tooltip.intent', () => {
  it.each([
    {
      name: 'shows hover at 300 not 299',
      run() {
        const armed = run(acquireHover);
        expect(delaysOf(armed.commands)).toEqual([{ kind: 'start-delay', ms: 300, token: 1 }]);
        expect(commitsOf(armed.commands)).toEqual([]);
        expect(armed.commands.some((command) => command.kind === 'start-delay' && command.ms === 299)).toBe(
          false,
        );
        const opened = run({ kind: 'delay-elapsed', token: 1 }, { state: armed.state });
        expect(commitsOf(opened.commands)).toEqual([{ kind: 'commit', open: true, reason: 'hover' }]);
      },
    },
    {
      name: 'hides at 100',
      run() {
        const opened = run({ kind: 'delay-elapsed', token: 1 }, { state: run(acquireHover).state });
        const armed = run(releaseHover, { state: opened.state, open: true });
        expect(delaysOf(armed.commands)).toEqual([{ kind: 'start-delay', ms: 100, token: 2 }]);
        const closed = run({ kind: 'delay-elapsed', token: 2 }, { state: armed.state, open: true });
        expect(commitsOf(closed.commands)).toEqual([{ kind: 'commit', open: false, reason: 'hover' }]);
      },
    },
    {
      name: 'leave before show cancels',
      run() {
        const armed = run(acquireHover);
        const left = run(releaseHover, { state: armed.state, open: false });
        expect(left.commands).toEqual([{ kind: 'clear-delay' }]);
        expect(left.state.pending).toBeNull();
        const stale = run({ kind: 'delay-elapsed', token: 1 }, { state: left.state });
        expect(stale.commands).toEqual([]);
        expect(commitsOf(stale.commands)).toEqual([]);
      },
    },
    {
      name: 'bridge release then acquire within the hide window never commits hide',
      run() {
        const opened = run({ kind: 'delay-elapsed', token: 1 }, { state: run(acquireHover).state });
        const leaving = run(releaseBridge, { state: opened.state, open: true });
        expect(delaysOf(leaving.commands)).toEqual([{ kind: 'start-delay', ms: 100, token: 2 }]);
        expect(leaving.state.pending?.reason).toBe('hover-bridge');
        const bridged = run(acquireBridge, { state: leaving.state, open: true });
        expect(bridged.commands).toEqual([{ kind: 'clear-delay' }]);
        expect(bridged.state.pending).toBeNull();
        const elapsed = run({ kind: 'delay-elapsed', token: 2 }, { state: bridged.state, open: true });
        expect(commitsOf(elapsed.commands)).toEqual([]);
      },
    },
    {
      name: 'coarse ignores hover acquire',
      run() {
        const ignored = run(acquireHover, { policy: coarse });
        expect(ignored.state.hover).toBe('idle');
        expect(wantsOpen(ignored.state)).toBe(false);
        expect(ignored.commands).toEqual([]);
      },
    },
    {
      name: 'focus show commits immediately',
      run() {
        const focused = run(acquireFocus);
        expect(focused.commands).toEqual([{ kind: 'commit', open: true, reason: 'focus' }]);
        expect(delaysOf(focused.commands)).toEqual([]);
      },
    },
    {
      name: 'warm hover show commits immediately and still hides on the hide delay',
      run() {
        const warm: TooltipPolicy = { ...fine, skipHoverShowDelay: true };
        const opened = run(acquireHover, { policy: warm });
        expect(opened.commands).toEqual([{ kind: 'commit', open: true, reason: 'hover' }]);
        expect(delaysOf(opened.commands)).toEqual([]);
        const hiding = run(releaseHover, { state: opened.state, open: true, policy: warm });
        expect(delaysOf(hiding.commands)).toEqual([{ kind: 'start-delay', ms: 100, token: 2 }]);
      },
    },
    {
      name: 'warm hover does not skip a delayed focus show',
      run() {
        const warm: TooltipPolicy = { ...fine, skipHoverShowDelay: true, delayFocus: true };
        const focused = run(acquireFocus, { policy: warm });
        expect(delaysOf(focused.commands)).toEqual([{ kind: 'start-delay', ms: 300, token: 1 }]);
        expect(commitsOf(focused.commands)).toEqual([]);
      },
    },
    {
      name: 'escape spends holds, acquire while spent is inert, release then acquire reopens',
      run() {
        const opened = run({ kind: 'delay-elapsed', token: 1 }, { state: run(acquireHover).state });
        const escaped = run({ kind: 'escape' }, { state: opened.state, open: true });
        expect(escaped.state.hover).toBe('spent');
        expect(escaped.state.focus).toBe('spent');
        expect(escaped.commands).toEqual([
          { kind: 'clear-delay' },
          { kind: 'commit', open: false, reason: 'escape' },
        ]);
        const inert = run(acquireHover, { state: escaped.state, open: false });
        expect(inert.state.hover).toBe('spent');
        expect(inert.commands).toEqual([]);
        const inertFocus = run(acquireFocus, { state: escaped.state, open: false });
        expect(inertFocus.state.focus).toBe('spent');
        expect(inertFocus.commands).toEqual([]);
        const released = run(releaseHover, { state: inert.state, open: false });
        expect(released.state.hover).toBe('idle');
        const reopened = run(acquireHover, { state: released.state, open: false });
        expect(delaysOf(reopened.commands)).toEqual([{ kind: 'start-delay', ms: 300, token: 2 }]);
      },
    },
    {
      name: 'stale token is dropped',
      run() {
        const armed = run(acquireHover);
        const stale = run({ kind: 'delay-elapsed', token: 0 }, { state: armed.state });
        expect(stale.commands).toEqual([]);
        expect(stale.state.pending?.token).toBe(1);
        const live = run({ kind: 'delay-elapsed', token: 1 }, { state: stale.state });
        expect(commitsOf(live.commands)).toEqual([{ kind: 'commit', open: true, reason: 'hover' }]);
      },
    },
    {
      name: 'veto after the first hide request produces no second commit',
      run() {
        const opened = run({ kind: 'delay-elapsed', token: 1 }, { state: run(acquireHover).state });
        const hiding = run(releaseHover, { state: opened.state, open: true });
        const vetoed = run({ kind: 'delay-elapsed', token: 2 }, { state: hiding.state, open: true });
        expect(commitsOf(vetoed.commands)).toEqual([{ kind: 'commit', open: false, reason: 'hover' }]);
        const again = run(releaseHover, { state: vetoed.state, open: true });
        expect(again.state.hover).toBe('idle');
        expect(wantsOpen(again.state)).toBe(false);
        expect(commitsOf(again.commands)).toEqual([]);
      },
    },
    {
      name: 're-entering an already-held channel produces no commands',
      run() {
        const held = run(acquireHover);
        const again = run(acquireHover, { state: held.state, open: false });
        expect(again.commands).toEqual([]);
        expect(again.state.pending?.token).toBe(1);
      },
    },
    {
      name: 'escape restores trigger focus when asked',
      run() {
        const opened = run(acquireFocus);
        const escaped = run(
          { kind: 'escape' },
          { state: opened.state, open: true, restoreFocus: true },
        );
        expect(escaped.commands).toEqual([
          { kind: 'clear-delay' },
          { kind: 'commit', open: false, reason: 'escape' },
          { kind: 'restore-trigger-focus' },
        ]);
        expect(escaped.state.focus).toBe('spent');
      },
    },
    {
      name: 'escape while closed is a no-op',
      run() {
        const idle = run({ kind: 'escape' }, { open: false });
        expect(idle).toEqual({ state: createIntent(), commands: [] });
      },
    },
    {
      name: 'focus release hides with reason focus',
      run() {
        const opened = run(acquireFocus);
        const hiding = run(releaseFocus, { state: opened.state, open: true });
        expect(hiding.state.pending).toEqual({ phase: 'hide', reason: 'focus', token: 2 });
        expect(delaysOf(hiding.commands)).toEqual([{ kind: 'start-delay', ms: 100, token: 2 }]);
      },
    },
  ])('$name', ({ run: apply }) => {
    apply();
  });

  it('treats spent as closed for wantsOpen', () => {
    const spent: TooltipIntentState = { hover: 'spent', focus: 'spent', pending: null, seq: 1 };
    expect(wantsOpen(spent)).toBe(false);
  });
});
