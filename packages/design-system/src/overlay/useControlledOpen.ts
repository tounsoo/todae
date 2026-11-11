import { useCallback } from 'react';

export type OverlayCloseReason =
  | 'escape'
  | 'backdrop'
  | 'drag'
  | 'close-button'
  | 'outside'
  | 'trigger';

export function useControlledOpen<Reason extends string = OverlayCloseReason>({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean, reason: Reason) => void;
}): { requestClose: (reason: Reason) => void } {
  const requestClose = useCallback(
    (reason: Reason) => {
      if (open) onOpenChange(false, reason);
    },
    [open, onOpenChange],
  );
  return { requestClose };
}
