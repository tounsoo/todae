import type { ComboboxOption } from './useCombobox.types';

export function defaultFilter(option: ComboboxOption, query: string): boolean {
  return option.label.toLowerCase().includes(query.trim().toLowerCase());
}

export function filterOptions(
  options: readonly ComboboxOption[],
  query: string,
  filter: (option: ComboboxOption, query: string) => boolean = defaultFilter,
): ComboboxOption[] {
  return options.filter((option) => filter(option, query));
}
