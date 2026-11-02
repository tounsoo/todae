import { mergeDescribedBy } from './Field.context.js';
import { useFieldsetState } from './Fieldset.context.js';
import { useRevalidate } from './Form.context.js';
import { Slider as ServerSlider, type SliderRootProps } from './Slider.js';

export type { SliderRootProps } from './Slider.js';

/** `aria-invalid` as a boolean, or undefined when it is not set. */
function ownInvalid(value: SliderRootProps['aria-invalid']): boolean | undefined {
  return value === undefined ? undefined : value === true || value === 'true';
}

// The main entry's Root: the server one, with the nearest Fieldset's state and a recheck of its validation scope.
function Root({
  disabled: disabledProp,
  'aria-invalid': ariaInvalid,
  'aria-describedby': describedBy,
  ...props
}: SliderRootProps) {
  const { disabled, invalid, errorId } = useFieldsetState({ disabled: disabledProp, invalid: ownInvalid(ariaInvalid) });
  useRevalidate();
  return (
    <ServerSlider.Root
      {...props}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={mergeDescribedBy(describedBy, errorId)}
    />
  );
}

export const Slider = { Root } as const;
