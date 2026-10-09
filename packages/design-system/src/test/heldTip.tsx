import { Button } from '../components/Button';
import { Tooltip } from '../components/Tooltip';
import { useTooltip } from '../hooks/useTooltip';

/** A button with a tip held open, as a controlled `useTooltip({ open })`. For browser tests. */
export function HeldTip({ label, open = true }: { label: string; open?: boolean }) {
  const tooltip = useTooltip({ open });
  return (
    <>
      <Button.Root tooltip={false} {...tooltip.getTriggerProps()}>
        {label}
      </Button.Root>
      <Tooltip.Root {...tooltip.getTooltipProps()}>Tip for {label}</Tooltip.Root>
    </>
  );
}
