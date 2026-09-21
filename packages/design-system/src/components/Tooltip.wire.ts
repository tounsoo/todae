import type { CSSProperties, PointerEvent } from 'react';

export type TooltipWire<I extends boolean = false> = {
  id: string;
  open: boolean;
  interactive: I;
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
} & (I extends true
  ? {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
      onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
    }
  : {});
