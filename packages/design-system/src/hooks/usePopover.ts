import { usePopoverInternal, type UsePopoverOptions, type UsePopoverResult } from '../overlay/popover.js';

export type {
  PopoverCloseReason,
  PopoverHaspopup,
  PopoverTriggerUserProps,
  PopoverTriggerWire,
  PopoverWire,
  UsePopoverOptions,
  UsePopoverResult,
} from '../overlay/popover.js';

/**
 * One popover's open state, dismissal and focus. Spread `getTriggerProps()`
 * onto the trigger and `getPopoverProps()` onto `Popover.Root`. The engine
 * lives in `overlay/popover.ts`, with Menu, Combobox and Mentions.
 */
export function usePopover(options: UsePopoverOptions = {}): UsePopoverResult {
  return usePopoverInternal(options, true);
}
