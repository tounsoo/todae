import type { AxeResults, RunOptions } from 'axe-core';

/** axe's color-contrast rule is WCAG 2; Todae checks contrast with APCA when tokens build, so that rule is off. */
export const AXE_OPTIONS: RunOptions = { rules: { 'color-contrast': { enabled: false } } };

/** One line per violation, then the selectors it hit. */
export function describeViolations(result: AxeResults): string[] {
  return result.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`);
}
