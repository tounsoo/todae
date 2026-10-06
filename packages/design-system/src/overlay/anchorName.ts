import type { CSSProperties } from 'react';

/**
 * The trigger style for an overlay anchored by `name`. `anchor-name` takes a
 * list, so a trigger that is also another overlay's anchor (a menu trigger
 * with a tooltip) keeps both names.
 */
export function anchorTriggerStyle(variable: string, name: string, existing?: CSSProperties): CSSProperties {
  return {
    [variable as string]: name,
    anchorName: mergeAnchorNames(existing?.anchorName, name),
  } as CSSProperties;
}

/** Adds `name` to an `anchor-name` list, once. */
export function mergeAnchorNames(existing: string | undefined, name: string): string {
  const names = (existing ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n !== '' && n !== 'none' && n !== name);
  return [...names, name].join(', ');
}
