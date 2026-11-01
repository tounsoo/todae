let open = 0;
let closedAt = 0;

export function hoverShowSkipsDelay(now: number, windowMs: number): boolean {
  return open > 0 || (closedAt > 0 && now - closedAt < windowMs);
}

export function retainHoverTip(): void {
  open += 1;
  closedAt = 0;
}

export function releaseHoverTip(now: number): void {
  if (!open) return;
  open -= 1;
  if (!open) closedAt = now;
}

export function resetTooltipWarmth(): void {
  open = 0;
  closedAt = 0;
}
