import type { ChipRootProps } from './Chip.js';
import { useStrings } from '../providers/StringsProvider.js';
import { Chip } from './Chip.js';
import { VisuallyHidden } from './VisuallyHidden.js';

type ChipCountProps = {
  count: number;
  /** Name read for +N. Default is the `moreChips` string, "{n} more" in English. */
  label?: (n: number) => string;
} & Omit<ChipRootProps, 'children'>;

/** The +N of a chip list: a plain chip hidden from assistive technology, then the name read in its place, as its next sibling. */
export function ChipCount({ count, label, ...props }: ChipCountProps) {
  const { moreChips } = useStrings();
  return (
    <>
      <Chip.Root {...props} aria-hidden data-overflow="">
        {`+${count}`}
      </Chip.Root>
      <VisuallyHidden.Root>{label?.(count) ?? moreChips(count)}</VisuallyHidden.Root>
    </>
  );
}
