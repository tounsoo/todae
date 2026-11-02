/** One row of an option list, as `options` lists it and `loadOptions` returns it. */
export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};
