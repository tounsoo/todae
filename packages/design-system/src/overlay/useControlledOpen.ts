import { useCallback } from 'react';

export type OverlayCloseReason = 'escape' | 'backdrop' | 'scrim' | 'drag' | 'close-button';

export function useControlledOpen({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean, reason: OverlayCloseReason) => void;
}): { requestClose: (reason: OverlayCloseReason) => void } {
  const requestClose = useCallback(
    (reason: OverlayCloseReason) => {
      if (open) onOpenChange(false, reason);
    },
    [open, onOpenChange],
  );
  return { requestClose };
}
