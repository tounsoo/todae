export function optionDomId(listId: string, value: string): string {
  return `${listId}-opt-${value.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
