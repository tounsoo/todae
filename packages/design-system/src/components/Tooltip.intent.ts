export type TooltipOpenReason = 'hover' | 'focus' | 'escape' | 'hover-bridge';

export type Hold = 'hover' | 'focus';
export type HoldPhase = 'idle' | 'held' | 'spent';

export type TooltipIntentState = {
  readonly hover: HoldPhase;
  readonly focus: HoldPhase;
  readonly pending: { readonly phase: 'show' | 'hide'; readonly reason: TooltipOpenReason; readonly token: number } | null;
  readonly seq: number;
};

export type TooltipPolicy = {
  readonly fidelity: 'fine' | 'coarse';
  readonly showDelayMs: number;
  readonly hideDelayMs: number;
};

export type TooltipEvent =
  | { readonly kind: 'acquire'; readonly hold: Hold; readonly reason: TooltipOpenReason }
  | { readonly kind: 'release'; readonly hold: Hold; readonly reason?: TooltipOpenReason }
  | { readonly kind: 'escape' }
  | { readonly kind: 'delay-elapsed'; readonly token: number };

export type TooltipCommand =
  | { readonly kind: 'start-delay'; readonly ms: number; readonly token: number }
  | { readonly kind: 'clear-delay' }
  | { readonly kind: 'commit'; readonly open: boolean; readonly reason: TooltipOpenReason }
  | { readonly kind: 'restore-trigger-focus' };

export type TooltipStepInput = {
  readonly policy: TooltipPolicy;
  readonly state: TooltipIntentState;
  readonly open: boolean;
  readonly event: TooltipEvent;
  readonly restoreFocus: boolean;
};

export type TooltipStepResult = {
  readonly state: TooltipIntentState;
  readonly commands: readonly TooltipCommand[];
};

export function createIntent(): TooltipIntentState {
  return { hover: 'idle', focus: 'idle', pending: null, seq: 0 };
}

export function wantsOpen(state: TooltipIntentState): boolean {
  return state.hover === 'held' || state.focus === 'held';
}

export function step(input: TooltipStepInput): TooltipStepResult {
  const { policy, state, open, event, restoreFocus } = input;
  switch (event.kind) {
    case 'delay-elapsed':
      return elapsed(state, event.token);
    case 'escape':
      return escape(state, open, restoreFocus);
    case 'acquire':
    case 'release':
      return hold(policy, state, open, event);
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

function elapsed(state: TooltipIntentState, token: number): TooltipStepResult {
  if (!state.pending || token !== state.pending.token) {
    return { state, commands: [] };
  }
  const reason = state.pending.reason;
  const nextOpen = state.pending.phase === 'show';
  return {
    state: { ...state, pending: null },
    commands: [{ kind: 'commit', open: nextOpen, reason }],
  };
}

function escape(state: TooltipIntentState, open: boolean, restoreFocus: boolean): TooltipStepResult {
  if (!open) return { state, commands: [] };
  const next: TooltipIntentState = {
    hover: nextHoldPhase(state.hover, 'escape', 'hover', 'fine'),
    focus: 'spent',
    pending: null,
    seq: state.seq,
  };
  const commands: TooltipCommand[] = [
    { kind: 'clear-delay' },
    { kind: 'commit', open: false, reason: 'escape' },
  ];
  if (restoreFocus) commands.push({ kind: 'restore-trigger-focus' });
  return { state: next, commands };
}

function hold(
  policy: TooltipPolicy,
  state: TooltipIntentState,
  open: boolean,
  event: Extract<TooltipEvent, { kind: 'acquire' | 'release' }>,
): TooltipStepResult {
  const phase = nextHoldPhase(state[event.hold], event.kind, event.hold, policy.fidelity);
  const next: TooltipIntentState = {
    hover: event.hold === 'hover' ? phase : state.hover,
    focus: event.hold === 'focus' ? phase : state.focus,
    pending: state.pending,
    seq: state.seq,
  };
  const before = wantsOpen(state);
  const after = wantsOpen(next);
  if (after === open) {
    const commands: TooltipCommand[] = state.pending ? [{ kind: 'clear-delay' }] : [];
    return { state: { ...next, pending: null }, commands };
  }
  if (after === before) {
    return { state: next, commands: [] };
  }
  const token = state.seq + 1;
  if (after) {
    const reason = showReason(event);
    if (reason === 'focus') {
      return {
        state: { ...next, pending: null, seq: token },
        commands: [{ kind: 'commit', open: true, reason: 'focus' }],
      };
    }
    return {
      state: { ...next, seq: token, pending: { phase: 'show', reason, token } },
      commands: [{ kind: 'start-delay', ms: policy.showDelayMs, token }],
    };
  }
  const reason = hideReason(event);
  return {
    state: { ...next, seq: token, pending: { phase: 'hide', reason, token } },
    commands: [{ kind: 'start-delay', ms: policy.hideDelayMs, token }],
  };
}

function nextHoldPhase(
  phase: HoldPhase,
  kind: 'acquire' | 'release' | 'escape',
  hold: Hold,
  fidelity: TooltipPolicy['fidelity'],
): HoldPhase {
  if (kind === 'release') return 'idle';
  if (kind === 'escape') return phase === 'held' ? 'spent' : phase;
  if (hold === 'hover' && fidelity === 'coarse' && phase === 'idle') return 'idle';
  if (phase === 'idle') return 'held';
  return phase;
}

function showReason(event: Extract<TooltipEvent, { kind: 'acquire' | 'release' }>): TooltipOpenReason {
  if (event.kind === 'acquire') return event.reason;
  return event.reason ?? (event.hold === 'focus' ? 'focus' : 'hover');
}

function hideReason(event: Extract<TooltipEvent, { kind: 'acquire' | 'release' }>): TooltipOpenReason {
  if (event.kind === 'release' && event.hold === 'focus') return 'focus';
  if (event.kind === 'release') return event.reason ?? 'hover';
  return event.reason;
}
