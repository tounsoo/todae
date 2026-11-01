type SharedHoverWarmth = {
  readonly open: number;
  readonly until: number;
};

const cool: SharedHoverWarmth = { open: 0, until: 0 };

let sharedHoverWarmth: SharedHoverWarmth = cool;

export function hoverShowSkipsDelay(now: number): boolean {
  return sharedHoverWarmth.open > 0 || now < sharedHoverWarmth.until;
}

export function retainHoverTip(): void {
  sharedHoverWarmth = { open: sharedHoverWarmth.open + 1, until: 0 };
}

export function releaseHoverTip(now: number, windowMs: number): void {
  if (sharedHoverWarmth.open <= 0) return;
  const open = sharedHoverWarmth.open - 1;
  sharedHoverWarmth = open > 0 ? { open, until: 0 } : { open: 0, until: now + windowMs };
}

export function resetTooltipWarmth(): void {
  sharedHoverWarmth = cool;
}
