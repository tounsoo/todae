import axe from 'axe-core';
import { AXE_OPTIONS, describeViolations, runAxe } from './axe.ts';

/** axe over `root` with the docs options and the open tree item recheck in `runAxe`, one line per violation. */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  return describeViolations(await runAxe(axe, root, AXE_OPTIONS));
}
