import type { AxeResults, RunOptions } from 'axe-core';

/** axe's color-contrast rule is WCAG 2; Todae checks contrast with APCA when tokens build, so that rule is off. */
export const AXE_OPTIONS: RunOptions = { rules: { 'color-contrast': { enabled: false } } };

/** One line per violation, then the selectors it hit. */
export function describeViolations(result: AxeResults): string[] {
  return result.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`);
}

/**
 * Runs axe over `root`, then rechecks each open tree item that
 * label-content-name-mismatch reports. axe 4.14 reads the text of an open
 * item's child items as part of that item's own visible label, so each open
 * branch of a nested ARIA tree fails while its row matches its name
 * (dequelabs/axe-core#5505; the fix is dequelabs/axe-core#5509). Tree.Item is
 * named by its Tree.Label row with aria-labelledby, as the ARIA tree pattern
 * asks. The recheck runs the same rule on the item with its child groups
 * hidden, and keeps the failure only if the row alone still fails. Its child
 * items are checked as nodes of their own. Drop this once axe ships the fix.
 *
 * Self-contained, so the built-site axe run can put its source in the page.
 */
export async function runAxe(axe: typeof import('axe-core'), root: Element | Document, options: RunOptions): Promise<AxeResults> {
  const rule = 'label-content-name-mismatch';
  const result = await axe.run(root, options);
  for (const violation of result.violations) {
    if (violation.id !== rule) continue;
    const kept: typeof violation.nodes = [];
    for (const node of violation.nodes) {
      const target = node.target.join(' ');
      const item = document.querySelector<HTMLElement>(target);
      const groups = item?.matches('[role="treeitem"][aria-expanded="true"]')
        ? [...item.querySelectorAll<HTMLElement>(':scope > [role="group"]')].filter((group) => !group.hidden)
        : [];
      if (!item || groups.length === 0) {
        kept.push(node);
        continue;
      }
      for (const group of groups) group.hidden = true;
      try {
        const row = await axe.run(item, { runOnly: [rule] });
        if (row.violations.some((v) => v.nodes.some((n) => n.target.join(' ') === target))) kept.push(node);
      } finally {
        for (const group of groups) group.hidden = false;
      }
    }
    violation.nodes = kept;
  }
  result.violations = result.violations.filter((violation) => violation.nodes.length > 0);
  return result;
}
