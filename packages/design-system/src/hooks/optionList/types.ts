/** One row of an option list, as `options` lists it and `loadOptions` returns it. */
export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/**
 * Picks the rows to show for the typed text, in the order to show them. `query` is the trimmed
 * text, and `''` while nothing is typed, so the result is also what an open list shows before
 * typing. It may drop, reorder or cap rows. It returns rows of `options`, each value once, since
 * the arrow keys find a row by its value.
 */
export type ComboboxFilterOptions = (
  options: readonly ComboboxOption[],
  query: string,
) => readonly ComboboxOption[];

