import { useLayoutEffect, useState, type ChangeEvent } from 'react';
import { mergeDescribedBy, useFieldContext } from './Field.context.js';
import { hasCounter, useRegistryValue } from './fieldRegistry.js';

/**
 * One change handler that calls `onChange` and `onValueChange`, or undefined
 * when neither is given, so the control renders read-only.
 */
export function valueChangeHandler<E extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
  onChange: ((event: ChangeEvent<E>) => void) | undefined,
  onValueChange: ((value: string) => void) | undefined,
): ((event: ChangeEvent<E>) => void) | undefined {
  if (!onChange && !onValueChange) return undefined;
  return (event) => {
    onChange?.(event);
    onValueChange?.(event.target.value);
  };
}

/**
 * What Field.TextInput and Field.Textarea share. It tells the field's
 * Field.Counter the text and its `limit` (the `maxLength` the counter shows,
 * or undefined for none), describes the control by the counter's limit while
 * a counter is in the field, and gives the change handler and `readOnly`: a
 * control with no handler is read-only unless it says otherwise.
 */
export function useTextControl<E extends HTMLInputElement | HTMLTextAreaElement>({
  value,
  limit,
  describedBy,
  onChange,
  onValueChange,
  readOnly,
}: {
  value: string;
  limit: number | undefined;
  describedBy: string | undefined;
  onChange: ((event: ChangeEvent<E>) => void) | undefined;
  onValueChange: ((value: string) => void) | undefined;
  readOnly: boolean | undefined;
}) {
  const { registry, hintId } = useFieldContext();
  const [self] = useState(() => ({}));
  // The server never commits, so the counter's server markup reads the text as rendered.
  registry.seedText({ value, maxLength: limit });
  useLayoutEffect(() => {
    registry.publishText(self, { value, maxLength: limit });
  }, [registry, self, value, limit]);
  useLayoutEffect(() => () => registry.publishText(self, null), [registry, self]);
  const counted = useRegistryValue(registry, hasCounter);
  return {
    describedBy: mergeDescribedBy(describedBy, counted && limit !== undefined ? hintId : undefined),
    onChange: valueChangeHandler(onChange, onValueChange),
    readOnly: readOnly ?? (!onChange && !onValueChange),
  };
}
