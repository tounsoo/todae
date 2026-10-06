import { domSafe } from './domId';

export function optionDomId(listId: string, value: string): string {
  return `${listId}-opt-${domSafe(value)}`;
}
