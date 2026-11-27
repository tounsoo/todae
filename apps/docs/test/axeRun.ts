import axe from 'axe-core';
import { AXE_OPTIONS, describeViolations } from './axe.ts';

const LABEL_IN_NAME = 'label-content-name-mismatch';

/**
 * axe 4.14 reads the text of an open tree item's child items as part of that
 * item's own visible label, so each open branch of a nested ARIA tree fails
 * label-content-name-mismatch while its row matches its name
 * (dequelabs/axe-core#5505; the fix is dequelabs/axe-core#5509). Tree.Item is
 * named by its Tree.Label row with aria-labelledby, as the ARIA tree pattern
 * asks.
 *
 * So for an open tree item that rule reports, run the same rule on the item
 * with its child groups hidden, and keep the failure only if the row alone
 * still fails. Its child items are checked as nodes of their own. Drop this
 * once axe ships the fix.
 */
async function rowStillFails(target: string): Promise<boolean> {
  const item = document.querySelector<HTMLElement>(target);
  if (!item?.matches('[role="treeitem"][aria-expanded="true"]')) return true;
  const groups = [...item.querySelectorAll<HTMLElement>(':scope > [role="group"]')].filter((group) => !group.hidden);
  if (groups.length === 0) return true;
  for (const group of groups) group.hidden = true;
  try {
    const row = await axe.run(item, { runOnly: [LABEL_IN_NAME] });
    return row.violations.some((violation) => violation.nodes.some((node) => node.target.join(' ') === target));
  } finally {
    for (const group of groups) group.hidden = false;
  }
}

/** axe over `root` with the docs options, one line per violation as describeViolations writes it. */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  const result = await axe.run(root, AXE_OPTIONS);
  for (const violation of result.violations) {
    if (violation.id !== LABEL_IN_NAME) continue;
    const kept: typeof violation.nodes = [];
    for (const node of violation.nodes) {
      if (await rowStillFails(node.target.join(' '))) kept.push(node);
    }
    violation.nodes = kept;
  }
  result.violations = result.violations.filter((violation) => violation.nodes.length > 0);
  return describeViolations(result);
}
