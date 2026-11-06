import { useTooltipInternal, type UseTooltipOptions, type UseTooltipResult } from '../overlay/tooltip.js';

export type {
  TooltipOpenReason,
  TooltipTriggerUserProps,
  TooltipTriggerWire,
  TooltipWire,
  UseTooltipOptions,
  UseTooltipResult,
} from '../overlay/tooltip.js';

/**
 * One tooltip's delays, holds and dismissal. Spread `getTriggerProps()` onto
 * the trigger and `getTooltipProps()` onto `Tooltip.Root`. The engine lives in
 * `overlay/tooltip.ts`, with Text's clamp tip and the mention peek.
 */
export function useTooltip<I extends boolean = false>(
  options: UseTooltipOptions<I> = {} as UseTooltipOptions<I>,
): UseTooltipResult<I> {
  const { holdHover: _holdHover, releaseHover: _releaseHover, holdFocus: _holdFocus, ...result } = useTooltipInternal(options);
  return result;
}
