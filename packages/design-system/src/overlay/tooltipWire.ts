import type { CSSProperties, PointerEvent } from 'react';

export type TooltipWire<I extends boolean = false> = {
  id: string;
  open: boolean;
  /**
   * The open skipped its hover show delay because another tip was open or had
   * just closed, so the tip shows at once instead of fading in. A tip that
   * opens cold, by focus, or by its owner fades in.
   */
  warm?: boolean;
  interactive: I;
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
} & (I extends true
  ? {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
      onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
    }
  : Record<never, never>);
