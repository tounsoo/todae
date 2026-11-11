import type { ComboboxFilterOptions } from './types.js';

/** The rows whose label holds the query, ignoring case, in their own order; every row for `''`. */
export const defaultFilterOptions: ComboboxFilterOptions = (options, query) => {
  const needle = query.toLowerCase();
  return needle === '' ? options : options.filter((option) => option.label.toLowerCase().includes(needle));
};
