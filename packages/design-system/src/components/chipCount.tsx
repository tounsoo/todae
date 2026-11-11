import type { ComponentPropsWithRef } from 'react';
import { useStrings } from '../providers/StringsProvider.js';
import { Chip } from './Chip.js';
import { VisuallyHidden } from './VisuallyHidden.js';

type ChipCountProps = {
  count: number;
  /** Name read for +N. Default is the `moreChips` string, "{n} more" in English. */
  label?: (n: number) => string;
} & Omit<ComponentPropsWithRef<'span'>, 'children'>;

/**
 * The +N chip alone. data-overflow marks it for ChipList's hover and focus
 * ring and keeps it out of Chip's own hover, since it is no control by itself.
 * A measure row ends with this, so useChipMeasure reads the same width as the
 * +N it lays out.
 */
export function ChipCountChip({ count, ...props }: Omit<ChipCountProps, 'label'>) {
  return (
    <Chip.Root {...props} data-overflow="">
      {`+${count}`}
    </Chip.Root>
  );
}

/** The +N of a chip list: the chip hidden from assistive technology, then the name read in its place, as its next sibling. */
export function ChipCount({ count, label, ...props }: ChipCountProps) {
  const { moreChips } = useStrings();
  return (
    <>
      <ChipCountChip {...props} count={count} aria-hidden />
      <VisuallyHidden.Root>{label?.(count) ?? moreChips(count)}</VisuallyHidden.Root>
    </>
  );
}
