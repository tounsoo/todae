import { useStrings } from '../providers/StringsProvider.js';
import type { ValueInputProps } from './valueInput.js';
import { VisuallyHidden } from './VisuallyHidden.js';

/**
 * A control's value input, and the "required" text that the control's
 * `aria-describedby` names by `requiredId`, which is set only while the
 * control is required.
 */
export function FieldValueInput({ input, requiredId }: { input: ValueInputProps; requiredId?: string }) {
  const strings = useStrings();
  return (
    <>
      <input {...input} />
      {requiredId ? <VisuallyHidden.Root id={requiredId}>{strings.required}</VisuallyHidden.Root> : null}
    </>
  );
}
