type SharedHoverWarmth = {
  readonly open: number;
  readonly closedAt: number | null;
};

let sharedHoverWarmth: SharedHoverWarmth = { open: 0, closedAt: null };

export function hoverShowSkipsDelay(now: number, windowMs: number): boolean {
  if (sharedHoverWarmth.open > 0) return true;
  if (sharedHoverWarmth.closedAt == null) return false;
  return now - sharedHoverWarmth.closedAt < windowMs;
}

export function retainHoverTip(): void {
  sharedHoverWarmth = { open: sharedHoverWarmth.open + 1, closedAt: null };
}

export function releaseHoverTip(now: number): void {
  if (sharedHoverWarmth.open <= 0) return;
  const open = sharedHoverWarmth.open - 1;
  sharedHoverWarmth = open > 0 ? { open, closedAt: null } : { open: 0, closedAt: now };
}

export function resetTooltipWarmth(): void {
  sharedHoverWarmth = { open: 0, closedAt: null };
}
