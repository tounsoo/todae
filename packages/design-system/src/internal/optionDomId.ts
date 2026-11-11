import { domSafe } from './domId.js';

export function optionDomId(listId: string, value: string): string {
  return `${listId}-opt-${domSafe(value)}`;
}
